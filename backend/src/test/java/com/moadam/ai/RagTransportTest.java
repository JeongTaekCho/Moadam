package com.moadam.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.ai.client.RagClient;
import com.moadam.ai.client.RagUnavailableException;
import com.moadam.ai.retrieval.NoteRetriever;
import com.moadam.note.repository.NoteRepository;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RagTransportTest {
  RagClient client(String url) {
    var retriever = mock(NoteRetriever.class);
    when(retriever.readyDocumentIds(any())).thenReturn(List.of());
    return new RagClient(
        new ObjectMapper(), mock(NoteRepository.class), retriever, url, "fixture-internal-token");
  }

  @Test
  void classifiesUpstreamStatusWithoutLeakingBodies() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    int[] status = {401};
    server.createContext(
        "/query/stream",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          byte[] bytes = "private upstream diagnostic".getBytes();
          exchange.sendResponseHeaders(status[0], bytes.length);
          exchange.getResponseBody().write(bytes);
          exchange.close();
        });
    server.start();
    var client = client("http://127.0.0.1:" + server.getAddress().getPort());
    try {
      for (int code : new int[] {401, 403, 404, 429, 503}) {
        status[0] = code;
        var error =
            assertThrows(
                RagUnavailableException.class,
                () ->
                    client.queryStream(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "fixture",
                        event -> {}));
        assertTrue(error.code().startsWith("AI_"));
        assertFalse(error.getMessage().contains("private upstream"));
        assertEquals(
            code == 401 || code == 403
                ? "AI_AUTH_FAILED"
                : code == 404
                    ? "AI_ENDPOINT_MISSING"
                    : code == 429 ? "AI_CAPACITY" : "AI_UPSTREAM_UNAVAILABLE",
            error.code());
      }
    } finally {
      client.shutdown();
      server.stop(0);
    }
  }

  @Test
  void classifiesConnectionFailure() throws Exception {
    int port;
    try (var socket = new java.net.ServerSocket(0)) {
      port = socket.getLocalPort();
    }
    var client = client("http://127.0.0.1:" + port);
    try {
      var error =
          assertThrows(
              RagUnavailableException.class,
              () ->
                  client.queryStream(
                      UUID.randomUUID(),
                      UUID.randomUUID(),
                      UUID.randomUUID(),
                      "fixture",
                      event -> {}));
      assertEquals("AI_CONNECTION_FAILED", error.code());
      assertNotNull(error.getCause());
    } finally {
      client.shutdown();
    }
  }
}
