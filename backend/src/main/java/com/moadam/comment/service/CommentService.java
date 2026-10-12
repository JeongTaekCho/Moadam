package com.moadam.comment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.comment.repository.CommentRepository;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import com.moadam.post.dto.CommentCreateRequest;
import com.moadam.post.dto.CommentResponse;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CommentService extends DomainService {
  private final CommentRepository repository;

  public CommentService(
      CommentRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json) {
    super(resources, mapper, policy, json);
    this.repository = repository;
  }

  private String column(String target) {
    return switch (target) {
      case "posts" -> "post_id";
      case "events" -> "event_id";
      default -> throw new IllegalArgumentException();
    };
  }

  private Map<String, Object> comment(String target, UUID group, UUID targetId, UUID id) {
    var row = one("comments", group, id);
    if (!Objects.equals(row.get(column(target)), targetId))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return row;
  }

  public Page<CommentResponse> list(
      Jwt jwt, UUID group, String target, UUID targetId, int page, int size) {
    policy.member(group, user(jwt));
    one(target, group, targetId);
    return typed(
        page("comments", group, page, size, "and " + column(target) + "=?", targetId),
        CommentResponse.class);
  }

  @Transactional
  public CommentResponse create(
      Jwt jwt, UUID group, String target, UUID targetId, CommentCreateRequest input) {
    policy.member(group, user(jwt));
    one(target, group, targetId);
    if (input.parent_id() != null) {
      var parent = comment(target, group, targetId, input.parent_id());
      if (parent.get("parent_id") != null || Boolean.TRUE.equals(parent.get("deleted")))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid reply target");
    }
    UUID id = UUID.randomUUID();
    repository.insert(
        id,
        group,
        target.equals("posts") ? targetId : null,
        target.equals("events") ? targetId : null,
        user(jwt),
        input.body().strip(),
        input.parent_id());
    audit(group, user(jwt), "comment.create", id);
    return dto(CommentResponse.class, one("comments", group, id));
  }

  @Transactional
  public CommentResponse update(
      Jwt jwt, UUID group, String target, UUID targetId, UUID id, CommentCreateRequest input) {
    policy.member(group, user(jwt));
    var row = comment(target, group, targetId, id);
    policy.author(group, user(jwt), row.get("author_id"));
    if (Boolean.TRUE.equals(row.get("deleted")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Comment is deleted");
    if (input.parent_id() != null && !Objects.equals(input.parent_id(), row.get("parent_id")))
      throw new IllegalArgumentException("Parent cannot change");
    repository.update(group, id, input.body().strip());
    audit(group, user(jwt), "comment.update", id);
    return dto(CommentResponse.class, one("comments", group, id));
  }

  @Transactional
  public Map<String, Boolean> delete(Jwt jwt, UUID group, String target, UUID targetId, UUID id) {
    policy.member(group, user(jwt));
    var row = comment(target, group, targetId, id);
    policy.author(group, user(jwt), row.get("author_id"));
    repository.delete(group, id);
    audit(group, user(jwt), "comment.delete", id);
    return Map.of("deleted", true);
  }
}
