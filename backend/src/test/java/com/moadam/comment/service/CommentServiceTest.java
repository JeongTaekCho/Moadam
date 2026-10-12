package com.moadam.comment.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.comment.repository.CommentRepository;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.post.dto.CommentCreateRequest;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

class CommentServiceTest {
  private final CommentRepository repository = mock(CommentRepository.class);
  private final ResourceRepository resources = mock(ResourceRepository.class);
  private final MembershipPolicy policy = mock(MembershipPolicy.class);
  private final CommentService service =
      new CommentService(repository, resources, mock(DtoMapper.class), policy, new ObjectMapper());
  private final UUID group = UUID.randomUUID(),
      target = UUID.randomUUID(),
      id = UUID.randomUUID(),
      user = UUID.randomUUID();
  private final Jwt jwt =
      Jwt.withTokenValue("fixture").header("alg", "none").subject(user.toString()).build();

  @Test
  void rejectsRepliesAcrossTargetsBeforeWriting() {
    when(resources.one("comments", group, id))
        .thenReturn(Map.of("post_id", UUID.randomUUID(), "author_id", user));
    var error =
        assertThrows(
            ResponseStatusException.class,
            () ->
                service.create(jwt, group, "posts", target, new CommentCreateRequest("reply", id)));
    assertEquals(404, error.getStatusCode().value());
    verifyNoInteractions(repository);
  }

  @Test
  void rejectsNestedOrDeletedReplyTargets() {
    when(resources.one("comments", group, id))
        .thenReturn(Map.of("event_id", target, "parent_id", UUID.randomUUID(), "author_id", user));
    assertThrows(
        ResponseStatusException.class,
        () -> service.create(jwt, group, "events", target, new CommentCreateRequest("reply", id)));
    when(resources.one("comments", group, id))
        .thenReturn(Map.of("event_id", target, "deleted", true, "author_id", user));
    assertThrows(
        ResponseStatusException.class,
        () -> service.create(jwt, group, "events", target, new CommentCreateRequest("reply", id)));
    verifyNoInteractions(repository);
  }

  @Test
  void enforcesOwnershipOnEditsAndDeletion() {
    when(resources.one("comments", group, id))
        .thenReturn(Map.of("post_id", target, "author_id", user));
    doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN))
        .when(policy)
        .author(group, user, user);
    assertThrows(
        ResponseStatusException.class,
        () ->
            service.update(
                jwt, group, "posts", target, id, new CommentCreateRequest("edit", null)));
    assertThrows(
        ResponseStatusException.class, () -> service.delete(jwt, group, "posts", target, id));
    verifyNoInteractions(repository);
  }

  @Test
  void writesEventReplyAndSoftDeletesWithoutRemovingReplies() {
    when(resources.one("comments", group, id))
        .thenReturn(Map.of("event_id", target, "author_id", user));
    service.create(jwt, group, "events", target, new CommentCreateRequest(" reply ", id));
    verify(repository)
        .insert(any(), eq(group), isNull(), eq(target), eq(user), eq("reply"), eq(id));
    service.delete(jwt, group, "events", target, id);
    verify(repository).delete(group, id);
  }
}
