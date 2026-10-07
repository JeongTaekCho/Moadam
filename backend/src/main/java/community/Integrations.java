package community;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class Integrations {
  final ObjectMapper json;
  final JdbcTemplate db;
  final String supabase, key, rag, token;
  final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  public Integrations(
      ObjectMapper json,
      JdbcTemplate db,
      @Value("${app.supabase}") String supabase,
      @Value("${app.storage-key}") String key,
      @Value("${app.rag-url}") String rag,
      @Value("${app.rag-token}") String token) {
    this.json = json;
    this.db = db;
    this.supabase = supabase;
    this.key = key;
    this.rag = rag;
    this.token = token;
  }

  Map<String, Object> request(String url, String method, Object body, boolean internal) {
    try {
      var r =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(internal ? 90 : 20))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + (internal ? token : key));
      if (!internal) r.header("apikey", key);
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

  String safe(String path) {
    if (!path.matches("[0-9a-f-]{36}/[0-9a-f-]{36}\\.pdf")) throw new IllegalArgumentException();
    return path;
  }

  public String uploadUrl(String path) {
    var r =
        request(
            supabase + "/storage/v1/object/upload/sign/group-documents/" + safe(path),
            "POST",
            Map.of(),
            false);
    String url = Objects.toString(r.get("url"), "");
    if (url.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    return supabase + "/storage/v1" + url;
  }

  public String downloadUrl(String path) {
    var r =
        request(
            supabase + "/storage/v1/object/sign/group-documents/" + safe(path),
            "POST",
            Map.of("expiresIn", 60),
            false);
    return supabase + "/storage/v1" + r.get("signedURL");
  }

  public void deleteFile(String path) {
    request(
        supabase + "/storage/v1/object/group-documents",
        "DELETE",
        Map.of("prefixes", List.of(safe(path))),
        false);
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
      db.update(
          "update documents set status='failed',error_code='RAG_UNAVAILABLE' where group_id=? and"
              + " id=? and status<>'ready'",
          g,
          id);
      throw e;
    }
  }

  public Map<String, Object> query(UUID g, UUID u, UUID session, String question) {
    var ids =
        db.queryForList(
            "select id from documents where group_id=? and status='ready'", UUID.class, g);
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
}
