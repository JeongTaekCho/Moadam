package com.moadam.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.ai.retrieval.NoteRetriever;
import com.moadam.note.repository.NoteRepository;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Internal authenticated HTTP transport to the existing Python RAG service. */
@Component
public class RagClient {
  private final ObjectMapper json;
  private final NoteRepository notes;
  private final NoteRetriever retriever;
  private final String rag, token;
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private final java.util.concurrent.ScheduledThreadPoolExecutor streamTimer = streamTimer();

  public RagClient(
      ObjectMapper json,
      NoteRepository notes,
      NoteRetriever retriever,
      @Value("${app.rag-url}") String rag,
      @Value("${app.rag-token}") String token) {
    this.json = json;
    this.notes = notes;
    this.retriever = retriever;
    this.rag = rag;
    this.token = token;
  }

  Map<String, Object> request(String url, String method, Object body, boolean internal) {
    try {
      var r =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(internal ? 90 : 20))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + token);

      r.method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
      var response = http.send(r.build(), HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300)
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
      var value = json.readTree(response.body());
      return value.isObject()
          ? json.convertValue(
              value, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {})
          : Map.of("result", value);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  static java.util.concurrent.ScheduledThreadPoolExecutor streamTimer() {
    var executor =
        new java.util.concurrent.ScheduledThreadPoolExecutor(
            1,
            task -> {
              var thread = new Thread(task, "rag-stream-timeout");
              thread.setDaemon(true);
              return thread;
            });
    executor.setRemoveOnCancelPolicy(true);
    return executor;
  }

  @jakarta.annotation.PreDestroy
  public void shutdown() {
    streamTimer.shutdownNow();
  }

  public void index(UUID g, UUID u, Map<String, Object> d) {
    UUID id = (UUID) d.get("id");
    try {
      request(
          rag + "/index",
          "POST",
          Map.of(
              "group_id",
              g,
              "user_id",
              u,
              "document_id",
              id,
              "version",
              d.get("version"),
              "request_id",
              UUID.randomUUID()),
          true);
    } catch (ResponseStatusException e) {
      notes.markIndexUnavailable(g, id);
      throw e;
    }
  }

  public Map<String, Object> query(UUID g, UUID u, UUID session, String question) {
    var ids = retriever.readyDocumentIds(g);
    return request(
        rag + "/query",
        "POST",
        Map.of(
            "group_id",
            g,
            "user_id",
            u,
            "session_id",
            session,
            "question",
            question,
            "allowed_document_ids",
            ids,
            "request_id",
            UUID.randomUUID()),
        true);
  }

  @FunctionalInterface
  public interface StreamConsumer {
    void accept(Map<String, Object> event) throws java.io.IOException;
  }

  public Map<String, Object> queryStream(
      UUID g, UUID u, UUID session, String question, StreamConsumer consumer)
      throws java.io.IOException {
    var ids = retriever.readyDocumentIds(g);
    var payload =
        Map.of(
            "group_id",
            g,
            "user_id",
            u,
            "session_id",
            session,
            "question",
            question,
            "allowed_document_ids",
            ids,
            "request_id",
            UUID.randomUUID());
    var request =
        HttpRequest.newBuilder(URI.create(rag + "/query/stream"))
            .timeout(Duration.ofSeconds(100))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload)))
            .build();
    try {
      var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
      var deadline =
          streamTimer.schedule(
              () -> {
                try {
                  response.body().close();
                } catch (java.io.IOException ignored) {
                }
              },
              100,
              java.util.concurrent.TimeUnit.SECONDS);
      try (var input = response.body();
          var reader =
              new java.io.BufferedReader(
                  new java.io.InputStreamReader(input, java.nio.charset.StandardCharsets.UTF_8))) {
        if (response.statusCode() != 200) throw new java.io.IOException("RAG unavailable");
        String line;
        int bytes = 0;
        while ((line = reader.readLine()) != null) {
          bytes += line.length();
          if (bytes > 250000) throw new java.io.IOException("Stream limit");
          if (line.isBlank()) continue;
          var event =
              json.readValue(
                  line,
                  new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
          String type = Objects.toString(event.get("type"), "");
          if (type.equals("error")) throw new java.io.IOException("RAG generation failed");
          if (type.equals("done"))
            return json.convertValue(
                event.get("result"),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
          if (type.equals("delta") || type.equals("status")) consumer.accept(event);
        }
        throw new java.io.IOException("Truncated stream");
      } finally {
        deadline.cancel(false);
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new java.io.IOException("Interrupted", e);
    }
  }
}
