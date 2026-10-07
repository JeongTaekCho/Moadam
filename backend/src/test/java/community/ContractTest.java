package community;

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
}
