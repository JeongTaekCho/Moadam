package com.moadam.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.ai.client.OpenAiClient;
import com.moadam.ai.dto.AiAnswerResponse;
import com.moadam.ai.dto.AiMessageResponse;
import com.moadam.ai.dto.AiQuestionRequest;
import com.moadam.ai.dto.AiSessionCreateRequest;
import com.moadam.ai.dto.AiSessionResponse;
import com.moadam.ai.repository.AiRepository;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@Service
public class AiService extends DomainService {
  private final AiRepository repository;
  private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AiService.class);
  private final org.springframework.transaction.support.TransactionTemplate transaction;
  private final OpenAiClient openAi;

  public AiService(
      AiRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json,
      OpenAiClient openAi,
      org.springframework.transaction.PlatformTransactionManager manager) {
    super(resources, mapper, policy, json);
    this.repository = repository;
    this.openAi = openAi;
    this.transaction = new org.springframework.transaction.support.TransactionTemplate(manager);
  }

  public Page<AiSessionResponse> sessions(Jwt j, UUID g, int page, int size) {
    policy.member(g, user(j));
    return typed(
        page("chat_sessions", g, page, size, "and user_id=?", user(j)), AiSessionResponse.class);
  }

  public AiSessionResponse createSession(Jwt j, UUID g, AiSessionCreateRequest b) {
    policy.member(g, user(j));
    UUID id = UUID.randomUUID();
    repository.insertSession(id, g, user(j), b.title());
    return session(j, g, id);
  }

  public AiSessionResponse session(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    var rows = repository.findOwnedSession(g, id, user(j));
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return dto(AiSessionResponse.class, rows.getFirst());
  }

  public Map<String, Boolean> deleteSession(Jwt j, UUID g, UUID id) {
    session(j, g, id);
    repository.deleteOwnedSession(g, id, user(j));
    return Map.of("deleted", true);
  }

  public Page<AiMessageResponse> messages(Jwt j, UUID g, UUID id, int page, int size) {
    session(j, g, id);
    var result = page("chat_messages", g, page, size, "and session_id=?", id);
    result
        .items()
        .forEach(
            r -> {
              try {
                r.put("citations", json.readValue(r.get("citations").toString(), List.class));
              } catch (Exception e) {
                r.put("citations", List.of());
              }
            });
    return typed(result, AiMessageResponse.class);
  }

  @Transactional
  public AiAnswerResponse ask(Jwt j, UUID g, UUID id, AiQuestionRequest b) {
    session(j, g, id);
    var result = openAi.query(g, user(j), id, b.question());
    session(j, g, id);
    repository.insertUserMessage(g, id, b.question());
    String citations;
    try {
      citations = json.writeValueAsString(result.getOrDefault("citations", List.of()));
    } catch (Exception e) {
      throw new IllegalStateException();
    }
    repository.insertAssistantMessage(
        g, id, (String) result.get("answer"), citations, (Boolean) result.get("grounded"));
    return dto(AiAnswerResponse.class, result);
  }

  void event(OutputStream output, Map<String, Object> value) throws IOException {
    output.write((json.writeValueAsString(value) + "\n").getBytes(StandardCharsets.UTF_8));
    output.flush();
  }

  AiMessageResponse message(Map<String, Object> row) {
    try {
      row.put("citations", json.readValue(row.get("citations").toString(), List.class));
    } catch (Exception e) {
      throw new IllegalStateException("Invalid citations", e);
    }
    return json.convertValue(row, AiMessageResponse.class);
  }

  Map<String, Object> save(
      Jwt jwt, UUID group, UUID session, String question, Map<String, Object> answer) {
    return transaction.execute(
        status -> {
          session(jwt, group, session);
          try {
            // The pair is committed atomically only after the complete validated result.
            var user = repository.insertUserMessageReturning(group, session, question);
            var assistant =
                repository.insertAssistantMessageReturning(
                    group,
                    session,
                    (String) answer.get("answer"),
                    json.writeValueAsString(answer.getOrDefault("citations", List.of())),
                    (Boolean) answer.get("grounded"));
            return Map.of("type", "done", "user", message(user), "assistant", message(assistant));
          } catch (IOException e) {
            throw new IllegalStateException(e);
          }
        });
  }

  public StreamingResponseBody openStream(Jwt jwt, UUID g, UUID id, AiQuestionRequest body) {
    session(jwt, g, id);
    return output -> {
      try {
        event(output, Map.of("type", "status", "stage", "retrieving"));
        var result =
            openAi.queryStream(
                g,
                UUID.fromString(jwt.getSubject()),
                id,
                body.question(),
                value -> event(output, value));
        // Probe the connection before persisting a completed answer.
        event(output, Map.of("type", "status", "stage", "saving"));
        event(output, save(jwt, g, id, body.question(), result));
      } catch (Exception e) {
        log.warn(
            "Chat stream failed: {} (cause: {})",
            e.getClass().getSimpleName(),
            e.getCause() == null ? "none" : e.getCause().getClass().getSimpleName());
        try {
          event(output, Map.of("type", "error", "message", "답변을 완료하지 못했습니다. 다시 시도해 주세요."));
        } catch (IOException disconnected) {
          /* Closing the upstream reader cancels generation. */
        }
      }
    };
  }
}
