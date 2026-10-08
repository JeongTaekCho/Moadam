package com.moadam;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.flyway.enabled=false",
      "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/postgres",
      "spring.datasource.username=test",
      "spring.datasource.password=test",
      "app.issuer=https://example.test/auth/v1",
      "app.supabase=https://example.test",
      "app.storage-key=placeholder",
      "app.rag-token=placeholder-32-character-test-token",
      "app.rag-url=http://127.0.0.1:1",
      "spring.datasource.hikari.initialization-fail-timeout=-1"
    })
class ContractTest {
  @Autowired TestRestTemplate http;

  @Test
  void exportsOpenApiAndRequiresAuthentication() throws Exception {
    var response = http.getForEntity("/v3/api-docs", String.class);
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertTrue(response.getBody().contains("PagePost"));
    Files.createDirectories(Path.of("../docs"));
    Files.writeString(Path.of("../docs/openapi.json"), response.getBody());
    var denied = http.getForEntity("/api/v1/groups", String.class);
    assertEquals(HttpStatus.UNAUTHORIZED, denied.getStatusCode());
    assertTrue(denied.getBody().contains("UNAUTHENTICATED"));
  }
  @Test
  void compressesLargeJsonResponses() throws Exception {
    var client = java.net.http.HttpClient.newHttpClient();
    var request = java.net.http.HttpRequest.newBuilder()
        .uri(java.net.URI.create(http.getRootUri() + "/v3/api-docs"))
        .header("Accept-Encoding", "gzip")
        .build();
    var response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
    assertEquals(200, response.statusCode());
    assertEquals("gzip", response.headers().firstValue("Content-Encoding").orElse(""));
    byte[] raw;
    try (var gzip = new java.util.zip.GZIPInputStream(new java.io.ByteArrayInputStream(response.body()))) {
      raw = gzip.readAllBytes();
    }
    assertTrue(new String(raw, java.nio.charset.StandardCharsets.UTF_8).contains("PagePost"));
    assertTrue(response.body().length < raw.length);
    System.out.printf("JSON compression: %d -> %d bytes%n", raw.length, response.body().length);
  }
}
