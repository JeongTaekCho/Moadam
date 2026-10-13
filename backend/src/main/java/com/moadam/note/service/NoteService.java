package com.moadam.note.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import com.moadam.common.storage.SupabaseStorageClient;
import com.moadam.note.dto.NoteCreateRequest;
import com.moadam.note.dto.NoteResponse;
import com.moadam.note.dto.NoteUpdateRequest;
import com.moadam.note.dto.NoteUploadRequest;
import com.moadam.note.dto.NoteUploadResponse;
import com.moadam.note.repository.NoteRepository;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService extends DomainService {
  private final NoteRepository repository;
  private final SupabaseStorageClient storage;
  private final DocumentJobService jobs;

  public NoteService(
      NoteRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json,
      SupabaseStorageClient storage,
      DocumentJobService jobs) {
    super(resources, mapper, policy, json);
    this.repository = repository;
    this.storage = storage;
    this.jobs = jobs;
  }

  public Page<NoteResponse> documents(Jwt j, UUID g, int page, int size) {
    policy.member(g, user(j));
    var result = page("documents", g, page, size, "");
    var active = jobs.activeDocuments(g);
    result
        .items()
        .forEach(
            r -> {
              r.put("processing_active", active.contains((UUID) r.get("id")));
              r.remove("storage_path");
              r.remove("text_content");
            });
    return typed(result, NoteResponse.class);
  }

  public NoteResponse document(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    var row = repository.findNote(g, id).toRow();
    row.put("processing_active", jobs.active(id, ((Number) row.get("version")).intValue()));
    row.remove("storage_path");
    return dto(NoteResponse.class, row);
  }

  @Transactional
  public NoteResponse memo(Jwt j, UUID g, NoteCreateRequest b) {
    policy.admin(g, user(j));
    jobs.capacity(g, jobs.bytes(b.text()), true);
    UUID id = UUID.randomUUID();
    repository.insertMemo(id, g, user(j), b.title(), b.text());
    jobs.enqueue(g, user(j), id, false);
    audit(g, user(j), "document.create", id);
    return document(j, g, id);
  }

  @Transactional
  public NoteResponse updateDocument(Jwt j, UUID g, UUID id, NoteUpdateRequest b) {
    policy.admin(g, user(j));
    jobs.capacity(g, 0, false);
    var d = repository.findNote(g, id).toRow();
    if (d.get("kind").equals("memo")) {
      if (b.text() == null || b.text().isBlank()) throw new IllegalArgumentException();
      jobs.capacity(g, jobs.bytes(b.text()) - jobs.bytes((String) d.get("text_content")), false);
      repository.updateMemo(b.title(), b.text(), g, id);
      jobs.enqueue(g, user(j), id, false);
    } else {
      repository.updatePdfTitle(b.title(), g, id);
    }
    audit(g, user(j), "document.update", id);
    return document(j, g, id);
  }

  @Transactional
  public NoteUploadResponse upload(Jwt j, UUID g, NoteUploadRequest b) {
    policy.admin(g, user(j));
    if (!b.filename().toLowerCase(Locale.ROOT).endsWith(".pdf")
        || b.filename().contains("/")
        || b.filename().contains("\\")
        || b.filename().contains("..")) throw new IllegalArgumentException();
    jobs.capacity(g, 20971520, true);
    jobs.uploadBudget(user(j));
    UUID id = UUID.randomUUID();
    String path = g + "/" + id + ".pdf";
    String url = storage.uploadUrl(path);
    repository.insertPdf(id, g, user(j), b.title(), path, b.size());
    jobs.beginUpload(id);
    audit(g, user(j), "document.upload", id);
    return new NoteUploadResponse(document(j, g, id), url, 7200);
  }

  @Transactional
  public NoteResponse index(Jwt j, UUID g, UUID id) {
    policy.admin(g, user(j));
    var d = repository.findNote(g, id).toRow();
    if (d.get("kind").equals("pdf")) {
      long bytes;
      try {
        bytes = storage.verifyPdf(d.get("storage_path").toString());
      } catch (com.moadam.common.storage.UploadMissingException missing) {
        jobs.missingUpload(g, id);
        throw missing;
      }
      jobs.completeUploadedFile(g, id, bytes);
    }
    jobs.enqueue(g, user(j), id, false);
    audit(g, user(j), "document.index", id);
    return document(j, g, id);
  }

  @Transactional
  public NoteUploadResponse resumeUpload(Jwt j, UUID g, UUID id) {
    policy.admin(g, user(j));
    var d = repository.findNote(g, id).toRow();
    if (!"pdf".equals(d.get("kind")) || !"pending".equals(d.get("status")))
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.CONFLICT, "재개할 수 있는 업로드가 아닙니다.");
    jobs.resume(g, id);
    return new NoteUploadResponse(
        document(j, g, id), storage.uploadUrl(d.get("storage_path").toString()), 7200);
  }

  public Map<String, String> download(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    var d = repository.findNote(g, id).toRow();
    if (!d.get("kind").equals("pdf")) throw new IllegalArgumentException();
    return Map.of("url", storage.downloadUrl(d.get("storage_path").toString()));
  }

  @Transactional
  public Map<String, Boolean> deleteDocument(Jwt j, UUID g, UUID id) {
    policy.admin(g, user(j));
    jobs.lockGroup(g);
    var d = repository.findNote(g, id).toRow();
    jobs.cleanupFile(d);
    repository.deleteNote(g, id);
    audit(g, user(j), "document.delete", id);
    return Map.of("deleted", true);
  }
}
