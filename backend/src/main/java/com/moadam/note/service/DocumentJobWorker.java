package com.moadam.note.service;

import com.moadam.ai.client.RagClient;
import com.moadam.common.storage.SupabaseStorageClient;
import com.moadam.note.repository.DocumentJobRepository;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.document-jobs.enabled", havingValue = "true")
public class DocumentJobWorker {
  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(DocumentJobWorker.class);
  private final DocumentJobRepository jobs;
  private final DocumentJobService service;
  private final RagClient rag;
  private final SupabaseStorageClient storage;

  public DocumentJobWorker(
      DocumentJobRepository jobs,
      DocumentJobService service,
      RagClient rag,
      SupabaseStorageClient storage) {
    this.jobs = jobs;
    this.service = service;
    this.rag = rag;
    this.storage = storage;
  }

  @Scheduled(fixedDelayString = "${app.document-jobs.poll-ms:2000}")
  public void run() {
    UUID token = UUID.randomUUID();
    try {
      var rows = jobs.claim(token);
      if (!rows.isEmpty()) process(rows.getFirst(), token);
    } catch (Exception e) {
      log.warn("Document worker unavailable: failure={}", e.getClass().getSimpleName());
    }
  }

  public void process(Map<String, Object> job, UUID token) {
    UUID id = (UUID) job.get("id"),
        group = (UUID) job.get("group_id"),
        documentId = (UUID) job.get("document_id");
    int version = ((Number) job.get("version")).intValue(),
        attempts = ((Number) job.get("attempts")).intValue();
    boolean deletion = "delete".equals(job.get("kind"));
    try {
      if (deletion) storage.deleteFile(job.get("storage_path").toString());
      else {
        var document = jobs.currentDocument(group, documentId);
        if (document == null
            || ((Number) document.get("version")).intValue() != version
            || "ready".equals(document.get("status"))) {
          jobs.finish(id, token);
          return;
        }
        var result = rag.index(group, (UUID) job.get("user_id"), document);
        if (!"ready".equals(result.get("status"))) {
          String code = Objects.toString(result.get("error_code"), "INDEX_FAILED");
          boolean retry =
              Set.of(
                          "INDEX_FAILED",
                          "EMBEDDING_UNAVAILABLE",
                          "PROVIDER_RATE_LIMITED",
                          "PROVIDER_UNAVAILABLE")
                      .contains(code)
                  && attempts < 5;
          if (!retry
              && Set.of(
                      "INDEX_FAILED",
                      "EMBEDDING_UNAVAILABLE",
                      "PROVIDER_RATE_LIMITED",
                      "PROVIDER_UNAVAILABLE")
                  .contains(code)) code = "INDEX_RETRY_EXHAUSTED";
          jobs.fail(id, token, code, retry, backoff(attempts));
          if (retry) jobs.retryDocument(group, documentId, version, code);
          else jobs.failedDocument(group, documentId, version, code);
          return;
        }
      }
      jobs.finish(id, token);
    } catch (Exception e) {
      boolean retry = deletion || attempts < 5;
      String code =
          deletion ? "STORAGE_DELETE_RETRY" : retry ? "RAG_UNAVAILABLE" : "INDEX_RETRY_EXHAUSTED";
      jobs.fail(id, token, code, retry, backoff(attempts));
      if (!deletion) {
        if (retry) jobs.retryDocument(group, documentId, version, code);
        else jobs.failedDocument(group, documentId, version, code);
      }
      log.warn(
          "Document job failed: kind={} code={} retry={} failure={}",
          job.get("kind"),
          code,
          retry,
          e.getClass().getSimpleName());
    }
  }

  static int backoff(int attempt) {
    return (int) Math.min(3600, 15L * (1L << Math.min(8, attempt)));
  }

  @Scheduled(
      fixedDelayString = "${app.document-jobs.orphan-scan-ms:3600000}",
      initialDelayString = "${app.document-jobs.cleanup-ms:60000}")
  public void reconcile() {
    try {
      jobs.registerOrphanFiles();
    } catch (Exception e) {
      log.warn("Storage reconciliation unavailable: failure={}", e.getClass().getSimpleName());
    }
  }

  @Scheduled(fixedDelayString = "${app.document-jobs.cleanup-ms:60000}")
  public void cleanup() {
    try {
      service.expireUploads();
    } catch (Exception e) {
      log.warn("Document cleanup unavailable: failure={}", e.getClass().getSimpleName());
    }
  }
}
