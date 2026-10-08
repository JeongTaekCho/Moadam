package com.moadam.post.controller;

import com.moadam.common.dto.Page;
import com.moadam.post.dto.CommentCreateRequest;
import com.moadam.post.dto.CommentResponse;
import com.moadam.post.dto.PostCreateRequest;
import com.moadam.post.dto.PostResponse;
import com.moadam.post.service.PostService;
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
public class PostController {
  private final PostService service;

  public PostController(PostService service) {
    this.service = service;
  }

  @GetMapping("/groups/{g}/posts")
  public Page<PostResponse> posts(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.posts(j, g, page, size);
  }

  @GetMapping("/groups/{g}/posts/{id}")
  public PostResponse post(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.post(j, g, id);
  }

  @PostMapping("/groups/{g}/posts")
  public PostResponse createPost(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @Valid @RequestBody PostCreateRequest b) {
    return service.createPost(j, g, b);
  }

  @PatchMapping("/groups/{g}/posts/{id}")
  public PostResponse updatePost(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody PostCreateRequest b) {
    return service.updatePost(j, g, id, b);
  }

  @DeleteMapping("/groups/{g}/posts/{id}")
  public Map<String, Boolean> deletePost(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.deletePost(j, g, id);
  }

  @GetMapping("/groups/{g}/posts/{p}/comments")
  public Page<CommentResponse> comments(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.comments(j, g, p, page, size);
  }

  @PostMapping("/groups/{g}/posts/{p}/comments")
  public CommentResponse comment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @Valid @RequestBody CommentCreateRequest b) {
    return service.comment(j, g, p, b);
  }

  @PatchMapping("/groups/{g}/posts/{p}/comments/{id}")
  public CommentResponse updateComment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @PathVariable UUID id,
      @Valid @RequestBody CommentCreateRequest b) {
    return service.updateComment(j, g, p, id, b);
  }

  @DeleteMapping("/groups/{g}/posts/{p}/comments/{id}")
  public Map<String, Boolean> deleteComment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @PathVariable UUID id) {
    return service.deleteComment(j, g, p, id);
  }
}
