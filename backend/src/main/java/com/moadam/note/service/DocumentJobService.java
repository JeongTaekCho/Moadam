package com.moadam.note.service;

import com.moadam.note.repository.DocumentJobRepository;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentJobService {
  private final DocumentJobRepository jobs;
  private final int maxDocuments, indexLimit, uploadLimit;
  private final long maxBytes;

  public DocumentJobService(
      DocumentJobRepository jobs,
      @Value("${app.documents.max-count:100}") int maxDocuments,
      @Value("${app.documents.max-bytes:209715200}") long maxBytes,
      @Value("${app.documents.daily-index-limit:20}") int indexLimit,
      @Value("${app.documents.daily-upload-limit:20}") int uploadLimit) {
    this.jobs = jobs;
    this.maxDocuments = maxDocuments;
    this.maxBytes = maxBytes;
    this.indexLimit = indexLimit;
    this.uploadLimit = uploadLimit;
  }

  public void lockGroup(UUID group) {
    jobs.lockGroup(group);
  }

  public void capacity(UUID group, long newBytes, boolean newDocument) {
    jobs.lockGroup(group);
    var current = jobs.capacity(group);
    if ((newDocument && ((Number) current.get("count")).longValue() >= maxDocuments)
        || (newBytes > 0 && ((Number) current.get("bytes")).longValue() + newBytes > maxBytes))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "모임 자료는 최대 "
              + maxDocuments
              + "개·할당 용량 "
              + (maxBytes / 1048576)
              + "MB까지 이용할 수 있어요. PDF는 파일당 20MB를 확보하며, 삭제한 파일의 정리가 완료되면 다시 이용할 수 있습니다.");
  }

  public java.util.Set<UUID> activeDocuments(UUID group) {
    return jobs.activeDocuments(group);
  }

  public boolean active(UUID id, int version) {
    return jobs.active(id, version);
  }

  public long bytes(String text) {
    return text.getBytes(StandardCharsets.UTF_8).length;
  }

  public void uploadBudget(UUID user) {
    if (!jobs.budget(user, true, uploadLimit))
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "오늘의 자료 업로드 한도를 모두 사용했어요. 한국 시간 자정 이후 다시 시도해 주세요.");
  }

  @Transactional
  public void enqueue(UUID group, UUID user, UUID id, boolean completeUpload) {
    var document = jobs.lockDocument(group, id);
    if (document == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    if (completeUpload) jobs.completeUpload(group, id);
    else if (Boolean.FALSE.equals(document.get("upload_completed")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "파일 업로드를 먼저 완료해 주세요.");
    int version = ((Number) document.get("version")).intValue();
    if ("ready".equals(document.get("status")) || jobs.active(id, version)) return;
    if (!jobs.budget(user, false, indexLimit))
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "오늘의 AI 자료 처리 한도를 모두 사용했어요. 한국 시간 자정 이후 다시 시도해 주세요.");
    jobs.enqueue(group, id, user, version);
  }

  public void cleanupFile(Map<String, Object> document) {
    var current = jobs.lockDocument((UUID) document.get("group_id"), (UUID) document.get("id"));
    if (current != null) jobs.cleanupFile(current);
  }

  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public void completeUploadedFile(UUID group, UUID id, long bytes) {
    if (jobs.lockDocument(group, id) == null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    jobs.uploadedSize(group, id, bytes);
  }

  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public void missingUpload(UUID group, UUID id) {
    if (jobs.lockDocument(group, id) != null) jobs.reopenUpload(group, id);
  }

  public void beginUpload(UUID id) {
    jobs.beginUpload(id);
  }

  @Transactional
  public void resume(UUID group, UUID id) {
    jobs.lockGroup(group);
    var document = jobs.lockDocument(group, id);
    if (document == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    if (!Boolean.FALSE.equals(document.get("upload_completed")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "완료된 업로드는 다시 변경할 수 없습니다.");
    jobs.renewUpload(id);
  }

  @Transactional
  public void cleanupGroup(UUID group) {
    jobs.lockGroup(group);
    jobs.groupFiles(group).forEach(jobs::cleanupFile);
  }

  @Transactional
  public void expireUploads() {
    for (var document : jobs.expiredUploads()) {
      var current = jobs.lockDocument((UUID) document.get("group_id"), (UUID) document.get("id"));
      if (current != null) jobs.cleanupFile(current);
      jobs.removeDocument((UUID) document.get("group_id"), (UUID) document.get("id"));
    }
    jobs.trimHistory();
  }
}
