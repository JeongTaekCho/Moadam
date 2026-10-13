package com.moadam.group;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.moadam.common.repository.ResourceRepository;
import com.moadam.group.dto.GroupCreateRequest;
import com.moadam.group.dto.GroupResponse;
import com.moadam.group.dto.InviteJoinRequest;
import com.moadam.group.exception.GroupLimitException;
import com.moadam.group.repository.GroupRepository;
import com.moadam.group.service.GroupService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

class GroupLimitTest {
  GroupRepository repository;
  ResourceRepository resources;
  GroupService service;
  Jwt jwt;
  UUID user = UUID.randomUUID(), group = UUID.randomUUID(), invite = UUID.randomUUID();
  GroupResponse response = new GroupResponse(group, "QA", "Asia/Seoul", "member", null, null);

  @BeforeEach
  void setup() {
    repository = mock(GroupRepository.class);
    resources = mock(ResourceRepository.class);
    service = spy(new GroupService(repository, resources, null, null, null, null));
    jwt = mock(Jwt.class);
    when(jwt.getSubject()).thenReturn(user.toString());
    doReturn(response).when(service).group(eq(jwt), any());
    when(repository.lockActiveInvite(any()))
        .thenReturn(List.of(Map.of("group_id", group, "id", invite)));
  }

  @Test
  void combinedMembershipCountBlocksBothCreateAndJoinWithoutSideEffects() {
    when(repository.countMembershipGroups(user)).thenReturn(3L);
    assertThrows(
        GroupLimitException.class,
        () -> service.createGroup(jwt, new GroupCreateRequest("QA", "Asia/Seoul")));
    assertThrows(
        GroupLimitException.class, () -> service.join(jwt, new InviteJoinRequest("test-invite")));
    verify(repository, never()).insertGroup(any(), any(), any());
    verify(repository, never()).insertOwner(any(), any());
    verify(repository, never()).insertMember(any(), any());
    verify(repository, never()).markInviteUsed(any());
    verifyNoInteractions(resources);
  }

  @Test
  void thirdGroupLocksAccountBeforeCountingAndCreating() {
    when(repository.countMembershipGroups(user)).thenReturn(2L);
    assertEquals(response, service.createGroup(jwt, new GroupCreateRequest("QA", "Asia/Seoul")));
    var order = inOrder(repository);
    order.verify(repository).lockMembershipChanges(user);
    order.verify(repository).countMembershipGroups(user);
    order.verify(repository).insertGroup(any(), eq("QA"), eq("Asia/Seoul"));
    order.verify(repository).insertOwner(any(), eq(user));
  }

  @Test
  void thirdMembershipLocksAndCountsBeforeConsumingInvite() {
    when(repository.countMembershipGroups(user)).thenReturn(2L);
    assertEquals(response, service.join(jwt, new InviteJoinRequest("test-invite")));
    var order = inOrder(repository);
    order.verify(repository).lockMembershipChanges(user);
    order.verify(repository).lockActiveInvite(any());
    order.verify(repository).hasMembership(group, user);
    order.verify(repository).countMembershipGroups(user);
    order.verify(repository).insertMember(group, user);
    order.verify(repository).markInviteUsed(invite);
  }

  @Test
  void existingMembershipDoesNotConsumeAnotherInvitationOrSlot() {
    when(repository.hasMembership(group, user)).thenReturn(true);
    assertEquals(response, service.join(jwt, new InviteJoinRequest("test-invite")));
    verify(repository, never()).countMembershipGroups(any());
    verify(repository, never()).markInviteUsed(any());
    verify(repository, never()).insertMember(any(), any());
  }

  @Test
  void invalidInviteIsNotReportedAsLimitFailure() {
    when(repository.lockActiveInvite(any())).thenReturn(List.of());
    assertEquals(
        404,
        assertThrows(
                ResponseStatusException.class,
                () -> service.join(jwt, new InviteJoinRequest("invalid")))
            .getStatusCode()
            .value());
  }
}
