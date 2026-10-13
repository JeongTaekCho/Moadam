package com.moadam.common.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class SupabaseStorageClient {
  private final ObjectMapper json;
  private final String supabase, key;
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  public SupabaseStorageClient(
      ObjectMapper json,
      @Value("${app.supabase}") String supabase,
      @Value("${app.storage-key}") String key) {
    this.json = json;
    this.supabase = supabase;
    this.key = key;
  }

  Map<String, Object> request(String url, String method, Object body) {
    try {
      var r =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(20))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + key);
      r.header("apikey", key);
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

  String avatarPath(String path) {
    if (!path.matches("[0-9a-f-]{36}/[0-9a-f-]{36}\\.png")) throw new IllegalArgumentException();
    return path;
  }

  public void putAvatar(String path, byte[] bytes) {
    try {
      var request =
          HttpRequest.newBuilder(
                  URI.create(supabase + "/storage/v1/object/profile-avatars/" + avatarPath(path)))
              .timeout(Duration.ofSeconds(20))
              .header("apikey", key)
              .header("Authorization", "Bearer " + key)
              .header("Content-Type", "image/png")
              .POST(HttpRequest.BodyPublishers.ofByteArray(bytes))
              .build();
      var response = http.send(request, HttpResponse.BodyHandlers.discarding());
      if (response.statusCode() < 200 || response.statusCode() >= 300)
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  public byte[] getAvatar(String path) {
    try {
      var request =
          HttpRequest.newBuilder(
                  URI.create(
                      supabase
                          + "/storage/v1/object/authenticated/profile-avatars/"
                          + avatarPath(path)))
              .timeout(Duration.ofSeconds(15))
              .header("apikey", key)
              .header("Authorization", "Bearer " + key)
              .GET()
              .build();
      var response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
      if (response.statusCode() != 200) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      return response.body();
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  public void deleteAvatarQuietly(String path) {
    try {
      request(
          supabase + "/storage/v1/object/profile-avatars",
          "DELETE",
          Map.of("prefixes", List.of(avatarPath(path))));
    } catch (Exception ignored) {
    }
  }

  public long verifyPdf(String path) {
    try {
      var request =
          HttpRequest.newBuilder(
                  URI.create(
                      supabase + "/storage/v1/object/authenticated/group-documents/" + safe(path)))
              .timeout(Duration.ofSeconds(15))
              .header("Authorization", "Bearer " + key)
              .header("apikey", key)
              .method("HEAD", HttpRequest.BodyPublishers.noBody())
              .build();
      var response = http.send(request, HttpResponse.BodyHandlers.discarding());
      if (response.statusCode() == 404) throw new UploadMissingException();
      if (response.statusCode() != 200)
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
      long size = response.headers().firstValueAsLong("Content-Length").orElse(-1);
      if (size < 1
          || size > 20971520
          || !response
              .headers()
              .firstValue("Content-Type")
              .orElse("")
              .toLowerCase(java.util.Locale.ROOT)
              .startsWith("application/pdf"))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "20MB 이하 PDF 파일을 업로드해 주세요.");
      return size;
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  public String uploadUrl(String path) {
    var r =
        request(
            supabase + "/storage/v1/object/upload/sign/group-documents/" + safe(path),
            "POST",
            Map.of());
    String url = Objects.toString(r.get("url"), "");
    if (url.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    return supabase + "/storage/v1" + url;
  }

  public String downloadUrl(String path) {
    var r =
        request(
            supabase + "/storage/v1/object/sign/group-documents/" + safe(path),
            "POST",
            Map.of("expiresIn", 60));
    return supabase + "/storage/v1" + r.get("signedURL");
  }

  public void deleteFile(String path) {
    request(
        supabase + "/storage/v1/object/group-documents",
        "DELETE",
        Map.of("prefixes", List.of(safe(path))));
  }
}
