package com.moadam.ai.controller;

import com.moadam.ai.dto.AiAnswerResponse;
import com.moadam.ai.dto.AiMessageResponse;
import com.moadam.ai.dto.AiQuestionRequest;
import com.moadam.ai.dto.AiSessionCreateRequest;
import com.moadam.ai.dto.AiSessionResponse;
import com.moadam.ai.service.AiService;
import com.moadam.common.dto.Page;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AiController {
  private final AiService service;

  public AiController(AiService service) {
    this.service = service;
  }

  @GetMapping("/groups/{g}/chat/sessions")
  public Page<AiSessionResponse> sessions(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.sessions(j, g, page, size);
  }

  @PostMapping("/groups/{g}/chat/sessions")
  public AiSessionResponse createSession(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @Valid @RequestBody AiSessionCreateRequest b) {
    return service.createSession(j, g, b);
  }

  @GetMapping("/groups/{g}/chat/sessions/{id}")
  public AiSessionResponse session(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.session(j, g, id);
  }

  @DeleteMapping("/groups/{g}/chat/sessions/{id}")
  public Map<String, Boolean> deleteSession(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.deleteSession(j, g, id);
  }

  @GetMapping("/groups/{g}/chat/sessions/{id}/messages")
  public Page<AiMessageResponse> messages(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.messages(j, g, id, page, size);
  }

  @PostMapping("/groups/{g}/chat/sessions/{id}/messages")
  public AiAnswerResponse ask(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody AiQuestionRequest b) {
    return service.ask(j, g, id, b);
  }

  @PostMapping(
      value = "/groups/{g}/chat/sessions/{id}/messages/stream",
      produces = "application/x-ndjson")
  public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody>
      askStream(
          @AuthenticationPrincipal Jwt jwt,
          @PathVariable UUID g,
          @PathVariable UUID id,
          @Valid @RequestBody AiQuestionRequest body) {
    var stream = service.openStream(jwt, g, id, body);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("application/x-ndjson"))
        .header("Cache-Control", "no-store")
        .header("X-Accel-Buffering", "no")
        .body(stream);
  }
}
