package com.moadam.post.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.comment.service.CommentService;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import com.moadam.post.dto.CommentCreateRequest;
import com.moadam.post.dto.CommentResponse;
import com.moadam.post.dto.PostCreateRequest;
import com.moadam.post.dto.PostResponse;
import com.moadam.post.repository.PostRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService extends DomainService {
  private final PostRepository repository;
  private final CommentService comments;

  public PostService(
      PostRepository repository,
      CommentService comments,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json) {
    super(resources, mapper, policy, json);
    this.repository = repository;
    this.comments = comments;
  }

  public Page<PostResponse> posts(Jwt j, UUID g, int page, int size) {
    policy.member(g, user(j));
    return typed(page("posts", g, page, size, ""), PostResponse.class);
  }

  public PostResponse post(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    return dto(PostResponse.class, one("posts", g, id));
  }

  @Transactional
  public PostResponse createPost(Jwt j, UUID g, PostCreateRequest b) {
    policy.member(g, user(j));
    if (b.kind().equals("notice")) policy.admin(g, user(j));
    UUID id = UUID.randomUUID();
    repository.insertPost(id, g, user(j), b.title(), b.body(), b.kind());
    audit(g, user(j), "post.create", id);
    return dto(PostResponse.class, one("posts", g, id));
  }

  @Transactional
  public PostResponse updatePost(Jwt j, UUID g, UUID id, PostCreateRequest b) {
    edit("posts", g, id, user(j));
    if (b.kind().equals("notice")) policy.admin(g, user(j));
    repository.updatePost(b.title(), b.body(), b.kind(), g, id);
    audit(g, user(j), "post.update", id);
    return dto(PostResponse.class, one("posts", g, id));
  }

  @Transactional
  public Map<String, Boolean> deletePost(Jwt j, UUID g, UUID id) {
    edit("posts", g, id, user(j));
    repository.deletePost(g, id);
    audit(g, user(j), "post.delete", id);
    return Map.of("deleted", true);
  }

  public Page<CommentResponse> comments(Jwt j, UUID g, UUID p, int page, int size) {
    return comments.list(j, g, "posts", p, page, size);
  }

  public CommentResponse comment(Jwt j, UUID g, UUID p, CommentCreateRequest b) {
    return comments.create(j, g, "posts", p, b);
  }

  public CommentResponse updateComment(Jwt j, UUID g, UUID p, UUID id, CommentCreateRequest b) {
    return comments.update(j, g, "posts", p, id, b);
  }

  public Map<String, Boolean> deleteComment(Jwt j, UUID g, UUID p, UUID id) {
    return comments.delete(j, g, "posts", p, id);
  }
}
