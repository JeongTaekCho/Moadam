package com.moadam.event.controller;

import com.moadam.comment.service.CommentService;
import com.moadam.common.dto.Page;
import com.moadam.event.dto.AttendanceRequest;
import com.moadam.event.dto.EventCreateRequest;
import com.moadam.event.dto.EventResponse;
import com.moadam.event.service.EventService;
import com.moadam.post.dto.CommentCreateRequest;
import com.moadam.post.dto.CommentResponse;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class EventController {
  private final EventService service;
  private final CommentService comments;

  public EventController(EventService service, CommentService comments) {
    this.service = service;
    this.comments = comments;
  }

  @GetMapping("/groups/{g}/events")
  public Page<EventResponse> events(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) Instant from) {
    return service.events(j, g, page, size, from);
  }

  @GetMapping("/groups/{g}/events/{id}")
  public EventResponse event(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.event(j, g, id);
  }

  @PostMapping("/groups/{g}/events")
  public EventResponse createEvent(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @Valid @RequestBody EventCreateRequest b) {
    return service.createEvent(j, g, b);
  }

  @PatchMapping("/groups/{g}/events/{id}")
  public EventResponse updateEvent(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody EventCreateRequest b) {
    return service.updateEvent(j, g, id, b);
  }

  @DeleteMapping("/groups/{g}/events/{id}")
  public Map<String, Boolean> deleteEvent(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.deleteEvent(j, g, id);
  }

  @GetMapping("/groups/{g}/events/{id}/attendance")
  public List<Map<String, Object>> attendance(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.attendance(j, g, id);
  }

  @PutMapping("/groups/{g}/events/{id}/attendance")
  public Map<String, Boolean> attend(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody AttendanceRequest b) {
    return service.attend(j, g, id, b);
  }

  @GetMapping("/groups/{g}/events/{id}/comments")
  public Page<CommentResponse> comments(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return comments.list(j, g, "events", id, page, size);
  }

  @PostMapping("/groups/{g}/events/{id}/comments")
  public CommentResponse comment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody CommentCreateRequest b) {
    return comments.create(j, g, "events", id, b);
  }

  @PatchMapping("/groups/{g}/events/{id}/comments/{commentId}")
  public CommentResponse updateComment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @PathVariable UUID commentId,
      @Valid @RequestBody CommentCreateRequest b) {
    return comments.update(j, g, "events", id, commentId, b);
  }

  @DeleteMapping("/groups/{g}/events/{id}/comments/{commentId}")
  public Map<String, Boolean> deleteComment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @PathVariable UUID commentId) {
    return comments.delete(j, g, "events", id, commentId);
  }
}
