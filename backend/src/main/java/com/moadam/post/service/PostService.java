package com.moadam.post.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
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
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PostService extends DomainService {
  private final PostRepository repository;

  public PostService(
      PostRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json) {
    super(resources, mapper, policy, json);
    this.repository = repository;
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
    policy.member(g, user(j));
    one("posts", g, p);
    return typed(page("comments", g, page, size, "and post_id=?", p), CommentResponse.class);
  }

  @Transactional
  public CommentResponse comment(Jwt j, UUID g, UUID p, CommentCreateRequest b) {
    policy.member(g, user(j));
    one("posts", g, p);
    UUID id = UUID.randomUUID();
    repository.insertComment(id, g, p, user(j), b.body());
    return dto(CommentResponse.class, one("comments", g, id));
  }

  @Transactional
  public CommentResponse updateComment(Jwt j, UUID g, UUID p, UUID id, CommentCreateRequest b) {
    edit("comments", g, id, user(j));
    if (!one("comments", g, id).get("post_id").equals(p))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    repository.updateComment(b.body(), g, p, id);
    return dto(CommentResponse.class, one("comments", g, id));
  }

  @Transactional
  public Map<String, Boolean> deleteComment(Jwt j, UUID g, UUID p, UUID id) {
    edit("comments", g, id, user(j));
    if (!one("comments", g, id).get("post_id").equals(p))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    repository.deleteComment(g, p, id);
    audit(g, user(j), "comment.delete", id);
    return Map.of("deleted", true);
  }
}
