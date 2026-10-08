package com.moadam.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.ai.client.OpenAiClient;
import com.moadam.ai.client.RagClient;
import com.moadam.ai.controller.AiController;
import com.moadam.ai.dto.AiQuestionRequest;
import com.moadam.ai.repository.AiRepository;
import com.moadam.ai.service.AiService;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.server.ResponseStatusException;

class AiStreamingTest {
  AiRepository repository;
  OpenAiClient client;
  PlatformTransactionManager transactions;
  AiService service;
  Jwt jwt;
  UUID group = UUID.randomUUID(), user = UUID.randomUUID(), session = UUID.randomUUID();

  @BeforeEach
  void setup() {
    repository = mock(AiRepository.class);
    client = mock(OpenAiClient.class);
    transactions = mock(PlatformTransactionManager.class);
    when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
    service =
        spy(new AiService(repository, null, null, null, new ObjectMapper(), client, transactions));
    jwt = mock(Jwt.class);
    when(jwt.getSubject()).thenReturn(user.toString());
    doReturn(null).when(service).session(jwt, group, session);
  }

  ByteArrayOutputStream stream() throws IOException {
    var response =
        new AiController(service).askStream(jwt, group, session, new AiQuestionRequest("질문"));
    assertEquals("application/x-ndjson", response.getHeaders().getContentType().toString());
    assertEquals("no-store", response.getHeaders().getCacheControl());
    var bytes = new ByteArrayOutputStream();
    response.getBody().writeTo(bytes);
    return bytes;
  }

  void answer() throws IOException {
    doAnswer(
            call -> {
              RagClient.StreamConsumer consumer = call.getArgument(4);
              consumer.accept(Map.of("type", "delta", "text", "한글 답변"));
              return Map.of("answer", "한글 답변", "citations", List.of(), "grounded", false);
            })
        .when(client)
        .queryStream(eq(group), eq(user), eq(session), eq("질문"), any());
  }

  Map<String, Object> row(String role) {
    var row = new HashMap<String, Object>();
    row.put("id", UUID.randomUUID());
    row.put("group_id", group);
    row.put("session_id", session);
    row.put("role", role);
    row.put("content", role.equals("user") ? "질문" : "한글 답변");
    row.put("citations", "[]");
    row.put("grounded", false);
    return row;
  }

  @Test
  void interruptedGenerationNeverSavesDrafts() throws Exception {
    doAnswer(
            call -> {
              RagClient.StreamConsumer consumer = call.getArgument(4);
              consumer.accept(Map.of("type", "delta", "text", "한글 부분 답변"));
              throw new IOException("Interrupted provider");
            })
        .when(client)
        .queryStream(eq(group), eq(user), eq(session), eq("질문"), any());
    var text = stream().toString(StandardCharsets.UTF_8);
    assertTrue(text.contains("\"type\":\"delta\""));
    assertTrue(text.contains("\"type\":\"error\""));
    assertFalse(text.contains("\"type\":\"done\""));
    verifyNoInteractions(repository, transactions);
    verify(service).session(jwt, group, session);
  }

  @Test
  void completedPairCommitsBeforeDoneAndRechecksOwnership() throws Exception {
    answer();
    when(repository.insertUserMessageReturning(group, session, "질문")).thenReturn(row("user"));
    when(repository.insertAssistantMessageReturning(group, session, "한글 답변", "[]", false))
        .thenReturn(row("assistant"));
    var text = stream().toString(StandardCharsets.UTF_8);
    assertTrue(text.contains("\"type\":\"done\""));
    assertTrue(text.contains("한글 답변"));
    verify(service, times(2)).session(jwt, group, session);
    var order = inOrder(repository, transactions);
    order.verify(transactions).getTransaction(any());
    order.verify(repository).insertUserMessageReturning(group, session, "질문");
    order.verify(repository).insertAssistantMessageReturning(group, session, "한글 답변", "[]", false);
    order.verify(transactions).commit(any());
    verify(transactions, never()).rollback(any());
  }

  @Test
  void revokedSessionAtCompletionRollsBackAndSavesNothing() throws Exception {
    answer();
    doReturn(null)
        .doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND))
        .when(service)
        .session(jwt, group, session);
    var text = stream().toString(StandardCharsets.UTF_8);
    assertTrue(text.contains("\"type\":\"error\""));
    assertFalse(text.contains("\"type\":\"done\""));
    verifyNoInteractions(repository);
    verify(transactions).rollback(any());
    verify(transactions, never()).commit(any());
  }

  @Test
  void failedAssistantInsertRollsBackWholePair() throws Exception {
    answer();
    when(repository.insertUserMessageReturning(group, session, "질문")).thenReturn(row("user"));
    when(repository.insertAssistantMessageReturning(group, session, "한글 답변", "[]", false))
        .thenThrow(new IllegalStateException("Database failure"));
    assertTrue(stream().toString(StandardCharsets.UTF_8).contains("\"type\":\"error\""));
    verify(transactions).rollback(any());
    verify(transactions, never()).commit(any());
  }
}
