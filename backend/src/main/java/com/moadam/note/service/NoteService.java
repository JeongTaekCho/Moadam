package com.moadam.note.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.ai.client.*;
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
import jakarta.validation.constraints.*;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@Service
public class NoteService extends DomainService {
  private final NoteRepository repository;
  private final SupabaseStorageClient storage;
  private final RagClient rag;

  public NoteService(
      NoteRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json,
      SupabaseStorageClient storage,
      RagClient rag) {
    super(resources, mapper, policy, json);
    this.repository = repository;
    this.storage = storage;
    this.rag = rag;
  }

  public Page<NoteResponse> documents(Jwt j, UUID g, int page, int size) {
    policy.member(g, user(j));
    var result = page("documents", g, page, size, "");
    result
        .items()
        .forEach(
            r -> {
              r.remove("storage_path");
              r.remove("text_content");
            });
    return typed(result, NoteResponse.class);
  }

  public NoteResponse document(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    var row = repository.findNote(g, id).toRow();
    row.remove("storage_path");
    return dto(NoteResponse.class, row);
  }

  @Transactional
  public NoteResponse memo(Jwt j, UUID g, NoteCreateRequest b) {
    policy.admin(g, user(j));
    UUID id = UUID.randomUUID();
    repository.insertMemo(id, g, user(j), b.title(), b.text());
    audit(g, user(j), "document.create", id);
    return document(j, g, id);
  }

  @Transactional
  public NoteResponse updateDocument(Jwt j, UUID g, UUID id, NoteUpdateRequest b) {
    policy.admin(g, user(j));
    var d = repository.findNote(g, id).toRow();
    if (d.get("kind").equals("memo")) {
      if (b.text() == null || b.text().isBlank()) throw new IllegalArgumentException();
      repository.updateMemo(b.title(), b.text(), g, id);
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
    UUID id = UUID.randomUUID();
    String path = g + "/" + id + ".pdf";
    String url = storage.uploadUrl(path);
    repository.insertPdf(id, g, user(j), b.title(), path, b.size());
    audit(g, user(j), "document.upload", id);
    return new NoteUploadResponse(document(j, g, id), url, 7200);
  }

  public NoteResponse index(Jwt j, UUID g, UUID id) {
    policy.admin(g, user(j));
    var d = repository.findNote(g, id).toRow();
    rag.index(g, user(j), d);
    audit(g, user(j), "document.index", id);
    return document(j, g, id);
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
    var d = repository.findNote(g, id).toRow();
    if (d.get("kind").equals("pdf")) storage.deleteFile(d.get("storage_path").toString());
    repository.deleteNote(g, id);
    audit(g, user(j), "document.delete", id);
    return Map.of("deleted", true);
  }
}
