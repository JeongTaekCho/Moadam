package com.moadam.common.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
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

  Map<String, Object> request(String url, String method, Object body, boolean internal) {
    try {
      var r =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(internal ? 90 : 20))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + key);
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
          Map.of("prefixes", List.of(avatarPath(path))),
          false);
    } catch (Exception ignored) {
    }
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
}
