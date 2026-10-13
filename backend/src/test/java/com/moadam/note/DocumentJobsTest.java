package com.moadam.note;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.moadam.ai.client.RagClient;
import com.moadam.common.storage.SupabaseStorageClient;
import com.moadam.note.repository.DocumentJobRepository;
import com.moadam.note.service.DocumentJobService;
import com.moadam.note.service.DocumentJobWorker;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DocumentJobsTest {
  UUID group = UUID.randomUUID(),
      document = UUID.randomUUID(),
      user = UUID.randomUUID(),
      token = UUID.randomUUID(),
      jobId = UUID.randomUUID();

  Map<String, Object> row(String status) {
    return Map.of("version", 2, "status", status, "upload_completed", true, "id", document);
  }

  Map<String, Object> job(String kind, int attempts) {
    return Map.of(
        "id",
        jobId,
        "group_id",
        group,
        "document_id",
        document,
        "user_id",
        user,
        "version",
        2,
        "kind",
        kind,
        "attempts",
        attempts,
        "storage_path",
        "private-path");
  }

  @Test
  void deletionBindsInstantDatesAndPreservesLatestUploadExpiry() {
    var db = mock(org.springframework.jdbc.core.JdbcTemplate.class);
    var repo = new DocumentJobRepository(db);
    var created = java.time.Instant.parse("2026-10-13T00:00:00Z");
    var expires = created.plusSeconds(7200);
    repo.cleanupFile(
        Map.of(
            "group_id",
            group,
            "id",
            document,
            "storage_path",
            "private-path",
            "created_at",
            created,
            "upload_expires_at",
            expires));
    verify(db)
        .update(
            anyString(),
            eq(group),
            eq(document),
            eq("private-path"),
            eq(java.sql.Timestamp.from(expires)),
            eq(java.sql.Timestamp.from(created)));
  }

  @Test
  void deduplicatesAcceptedWorkWithoutChargingAgain() {
    var repo = mock(DocumentJobRepository.class);
    var service = new DocumentJobService(repo, 100, 209715200, 20, 20);
    when(repo.lockDocument(group, document)).thenReturn(row("pending"));
    when(repo.active(document, 2)).thenReturn(true);
    service.enqueue(group, user, document, false);
    verify(repo, never()).budget(any(), anyBoolean(), anyInt());
    verify(repo, never()).enqueue(any(), any(), any(), anyInt());
  }

  @Test
  void readyDocumentIsNotReindexedAndLimitFailureCannotQueueWork() {
    var repo = mock(DocumentJobRepository.class);
    var service = new DocumentJobService(repo, 100, 209715200, 20, 20);
    when(repo.lockDocument(group, document)).thenReturn(row("ready"));
    service.enqueue(group, user, document, false);
    verify(repo, never()).budget(any(), anyBoolean(), anyInt());
    when(repo.lockDocument(group, document)).thenReturn(row("pending"));
    when(repo.budget(user, false, 20)).thenReturn(false);
    assertEquals(
        429,
        assertThrows(
                ResponseStatusException.class, () -> service.enqueue(group, user, document, false))
            .getStatusCode()
            .value());
    verify(repo, never()).enqueue(any(), any(), any(), anyInt());
  }

  @Test
  void capacityCountsPendingFileDeletionsAndStopsOverflow() {
    var repo = mock(DocumentJobRepository.class);
    var service = new DocumentJobService(repo, 100, 209715200, 20, 20);
    when(repo.capacity(group)).thenReturn(Map.of("count", 100L, "bytes", 1L));
    assertThrows(ResponseStatusException.class, () -> service.capacity(group, 1, true));
    when(repo.capacity(group)).thenReturn(Map.of("count", 1L, "bytes", 209715200L));
    assertThrows(ResponseStatusException.class, () -> service.capacity(group, 1, false));
  }

  @Test
  void deletedOrUpdatedVersionNeverCallsProvider() {
    var repo = mock(DocumentJobRepository.class);
    var rag = mock(RagClient.class);
    var storage = mock(SupabaseStorageClient.class);
    var worker = new DocumentJobWorker(repo, null, rag, storage);
    when(repo.currentDocument(group, document)).thenReturn(null);
    worker.process(job("index", 1), token);
    verify(repo).finish(jobId, token);
    verifyNoInteractions(rag, storage);
  }

  @Test
  void permanentIndexFailureIsNotReportedAsSuccess() {
    var repo = mock(DocumentJobRepository.class);
    var rag = mock(RagClient.class);
    var worker = new DocumentJobWorker(repo, null, rag, null);
    when(repo.currentDocument(group, document)).thenReturn(row("pending"));
    when(rag.index(group, user, row("pending")))
        .thenReturn(Map.of("status", "failed", "error_code", "NO_TEXT_OCR_UNSUPPORTED"));
    worker.process(job("index", 1), token);
    verify(repo).fail(eq(jobId), eq(token), eq("NO_TEXT_OCR_UNSUPPORTED"), eq(false), anyInt());
    verify(repo, never()).finish(any(), any());
  }

  @Test
  void storageOutageRetriesEvenBeyondIndexRetryLimit() {
    var repo = mock(DocumentJobRepository.class);
    var storage = mock(SupabaseStorageClient.class);
    var worker = new DocumentJobWorker(repo, null, null, storage);
    doThrow(new IllegalStateException()).when(storage).deleteFile("private-path");
    worker.process(job("delete", 8), token);
    verify(repo).fail(eq(jobId), eq(token), eq("STORAGE_DELETE_RETRY"), eq(true), anyInt());
    verify(repo, never()).finish(any(), any());
  }
}
