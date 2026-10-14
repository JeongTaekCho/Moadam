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
  GroupResponse response =
      new GroupResponse(group, "QA", "Asia/Seoul", "member", 30, 1, null, null);

  @BeforeEach
  void setup() {
    repository = mock(GroupRepository.class);
    resources = mock(ResourceRepository.class);
    service =
        spy(
            new GroupService(
                repository,
                resources,
                null,
                mock(com.moadam.auth.MembershipPolicy.class),
                null,
                null));
    jwt = mock(Jwt.class);
    when(jwt.getSubject()).thenReturn(user.toString());
    doReturn(response).when(service).group(eq(jwt), any());
    when(repository.lockGroupCapacity(any())).thenReturn(30);
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
    verify(repository, never()).insertGroup(any(), any(), any(), anyInt());
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
    order.verify(repository).insertGroup(any(), eq("QA"), eq("Asia/Seoul"), eq(30));
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
    when(repository.lockGroupCapacity(any())).thenReturn(30);
    when(repository.lockActiveInvite(any())).thenReturn(List.of());
    assertEquals(
        404,
        assertThrows(
                ResponseStatusException.class,
                () -> service.join(jwt, new InviteJoinRequest("invalid")))
            .getStatusCode()
            .value());
  }

  @Test
  void fullGroupDoesNotConsumeInviteAndCanBeRetriedAfterCapacityIncrease() {
    when(repository.lockGroupCapacity(group)).thenReturn(2);
    when(repository.countMembers(group)).thenReturn(2);
    var error =
        assertThrows(
            ResponseStatusException.class,
            () -> service.join(jwt, new InviteJoinRequest("test-invite")));
    assertEquals(409, error.getStatusCode().value());
    assertTrue(error.getReason().contains("정원(2명)"));
    verify(repository, never()).insertMember(any(), any());
    verify(repository, never()).markInviteUsed(any());
    when(repository.lockGroupCapacity(group)).thenReturn(3);
    assertEquals(response, service.join(jwt, new InviteJoinRequest("test-invite")));
    var order = inOrder(repository);
    order.verify(repository).lockGroupCapacity(group);
    order.verify(repository).countMembers(group);
    order.verify(repository).lockGroupCapacity(group);
    order.verify(repository).countMembers(group);
    order.verify(repository).insertMember(group, user);
    order.verify(repository).markInviteUsed(invite);
  }

  @Test
  void settingsCannotShrinkBelowMembersAndLockBeforeCounting() {
    when(repository.countMembers(group)).thenReturn(8);
    var error =
        assertThrows(
            ResponseStatusException.class,
            () -> service.updateGroup(jwt, group, new GroupCreateRequest("QA", "Asia/Seoul", 7)));
    assertEquals(409, error.getStatusCode().value());
    assertTrue(error.getReason().contains("8명 이상"));
    verify(repository, never()).updateGroup(any(), any(), anyInt(), any());
    service.updateGroup(jwt, group, new GroupCreateRequest("QA", "Asia/Seoul", 8));
    var order = inOrder(repository);
    order.verify(repository).lockGroupCapacity(group);
    order.verify(repository).countMembers(group);
    order.verify(repository).lockGroupCapacity(group);
    order.verify(repository).countMembers(group);
    order.verify(repository).updateGroup("QA", "Asia/Seoul", 8, group);
  }

  @Test
  void omittedCapacityKeepsExistingSettingOnUpdate() {
    when(repository.lockGroupCapacity(group)).thenReturn(12);
    service.updateGroup(jwt, group, new GroupCreateRequest("QA", "Asia/Seoul"));
    verify(repository).updateGroup("QA", "Asia/Seoul", 12, group);
  }

  @Test
  void capacityRequestBoundariesAreValidated() {
    try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      for (int capacity : new int[] {1, 30})
        assertTrue(
            validator.validate(new GroupCreateRequest("QA", "Asia/Seoul", capacity)).isEmpty());
      for (int capacity : new int[] {0, -1, 31})
        assertFalse(
            validator.validate(new GroupCreateRequest("QA", "Asia/Seoul", capacity)).isEmpty());
    }
  }

  @Test
  void creationPersistsSelectedCapacity() {
    service.createGroup(jwt, new GroupCreateRequest("QA", "Asia/Seoul", 12));
    verify(repository).insertGroup(any(), eq("QA"), eq("Asia/Seoul"), eq(12));
  }
}
