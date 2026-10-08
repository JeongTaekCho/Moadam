package com.moadam.note.controller;

import com.moadam.common.dto.Page;
import com.moadam.note.dto.NoteCreateRequest;
import com.moadam.note.dto.NoteResponse;
import com.moadam.note.dto.NoteUpdateRequest;
import com.moadam.note.dto.NoteUploadRequest;
import com.moadam.note.dto.NoteUploadResponse;
import com.moadam.note.service.NoteService;
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
public class NoteController {
  private final NoteService service;

  public NoteController(NoteService service) {
    this.service = service;
  }

  @GetMapping("/groups/{g}/documents")
  public Page<NoteResponse> documents(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.documents(j, g, page, size);
  }

  @GetMapping("/groups/{g}/documents/{id}")
  public NoteResponse document(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.document(j, g, id);
  }

  @PostMapping("/groups/{g}/documents")
  public NoteResponse memo(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @Valid @RequestBody NoteCreateRequest b) {
    return service.memo(j, g, b);
  }

  @PatchMapping("/groups/{g}/documents/{id}")
  public NoteResponse updateDocument(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody NoteUpdateRequest b) {
    return service.updateDocument(j, g, id, b);
  }

  @PostMapping("/groups/{g}/documents/uploads")
  public NoteUploadResponse upload(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @Valid @RequestBody NoteUploadRequest b) {
    return service.upload(j, g, b);
  }

  @PostMapping({"/groups/{g}/documents/{id}/index", "/groups/{g}/documents/{id}/complete"})
  public NoteResponse index(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.index(j, g, id);
  }

  @GetMapping("/groups/{g}/documents/{id}/download")
  public Map<String, String> download(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.download(j, g, id);
  }

  @DeleteMapping("/groups/{g}/documents/{id}")
  public Map<String, Boolean> deleteDocument(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.deleteDocument(j, g, id);
  }
}
