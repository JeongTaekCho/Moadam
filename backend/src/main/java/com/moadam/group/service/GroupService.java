package com.moadam.group.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import com.moadam.group.dto.GroupCreateRequest;
import com.moadam.group.dto.GroupResponse;
import com.moadam.group.dto.InviteJoinRequest;
import com.moadam.group.dto.InviteResponse;
import com.moadam.group.dto.MemberResponse;
import com.moadam.group.dto.MemberRoleRequest;
import com.moadam.group.exception.GroupLimitException;
import com.moadam.group.repository.GroupRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GroupService extends DomainService {
  private final GroupRepository repository;
  private final com.moadam.note.service.DocumentJobService jobs;

  public GroupService(
      GroupRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json,
      com.moadam.note.service.DocumentJobService jobs) {
    super(resources, mapper, policy, json);
    this.repository = repository;
    this.jobs = jobs;
  }

  public Page<GroupResponse> groups(Jwt j, int page, int size) {
    if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException();
    return typed(
        new Page<>(
            repository.findMembershipGroups(user(j), size, (long) page * size),
            page,
            size,
            repository.countMembershipGroups(user(j))),
        GroupResponse.class);
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public GroupResponse createGroup(Jwt j, GroupCreateRequest b) {
    if (!ZoneId.getAvailableZoneIds().contains(b.timezone())) throw new IllegalArgumentException();
    repository.lockMembershipChanges(user(j));
    checkGroupLimit(user(j));
    UUID g = UUID.randomUUID();
    repository.insertGroup(
        g, b.name(), b.timezone(), b.max_members() == null ? 30 : b.max_members());
    repository.insertOwner(g, user(j));
    audit(g, user(j), "group.create", g);
    return group(j, g);
  }

  private void checkGroupLimit(UUID user) {
    if (repository.countMembershipGroups(user) >= 3) throw new GroupLimitException();
  }

  public GroupResponse group(Jwt j, UUID g) {
    String role = policy.member(g, user(j));
    var row = repository.findGroup(g);
    row.put("role", role);
    return dto(GroupResponse.class, row);
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public GroupResponse updateGroup(Jwt j, UUID g, GroupCreateRequest b) {
    policy.owner(g, user(j));
    if (!ZoneId.getAvailableZoneIds().contains(b.timezone())) throw new IllegalArgumentException();
    int currentCapacity = repository.lockGroupCapacity(g);
    int capacity = b.max_members() == null ? currentCapacity : b.max_members();
    int members = repository.countMembers(g);
    if (capacity < members)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "현재 참여 인원은 " + members + "명입니다. 최대 인원을 " + members + "명 이상으로 설정해 주세요.");
    repository.updateGroup(b.name(), b.timezone(), capacity, g);
    audit(g, user(j), "group.update", g);
    return group(j, g);
  }

  @Transactional
  public Map<String, Boolean> deleteGroup(Jwt j, UUID g) {
    policy.owner(g, user(j));
    jobs.cleanupGroup(g);
    audit(g, user(j), "group.delete", g);
    repository.deleteGroup(g);
    return Map.of("deleted", true);
  }

  public Page<MemberResponse> members(Jwt j, UUID g, int page, int size) {
    policy.member(g, user(j));
    return typed(page("group_members", g, page, size, ""), MemberResponse.class);
  }

  @Transactional
  public Map<String, Boolean> role(Jwt j, UUID g, UUID id, MemberRoleRequest b) {
    policy.owner(g, user(j));
    if (policy.member(g, id).equals("owner"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    repository.updateRole(b.role(), g, id);
    audit(g, user(j), "member.role", id);
    return Map.of("updated", true);
  }

  @Transactional
  public Map<String, Boolean> remove(Jwt j, UUID g, UUID id) {
    String actor = policy.member(g, user(j));
    String target = policy.member(g, id);
    if (target.equals("owner")
        || actor.equals("member")
        || actor.equals("admin") && !target.equals("member"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    repository.deleteMember(g, id);
    audit(g, user(j), "member.remove", id);
    return Map.of("deleted", true);
  }

  @Transactional
  public Map<String, Boolean> leave(Jwt j, UUID g) {
    if (policy.member(g, user(j)).equals("owner"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    audit(g, user(j), "member.leave", user(j));
    repository.deleteMembership(g, user(j));
    return Map.of("deleted", true);
  }

  static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Page<InviteResponse> invites(Jwt j, UUID g, int page, int size) {
    policy.admin(g, user(j));
    var result = page("group_invites", g, page, size, "");
    result.items().forEach(r -> r.remove("token_hash"));
    return typed(result, InviteResponse.class);
  }

  @Transactional
  public Map<String, Object> invite(Jwt j, UUID g) {
    policy.admin(g, user(j));
    byte[] random = new byte[32];
    new SecureRandom().nextBytes(random);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    UUID id = UUID.randomUUID();
    repository.insertInvite(id, g, hash(token), user(j));
    audit(g, user(j), "invite.create", id);
    return Map.of("id", id, "token", token, "expires_at", Instant.now().plusSeconds(604800));
  }

  @Transactional
  public Map<String, Boolean> revoke(Jwt j, UUID g, UUID id) {
    policy.admin(g, user(j));
    one("group_invites", g, id);
    repository.revokeInvite(g, id);
    audit(g, user(j), "invite.revoke", id);
    return Map.of("deleted", true);
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public GroupResponse join(Jwt j, InviteJoinRequest b) {
    repository.lockMembershipChanges(user(j));
    var rows = repository.lockActiveInvite(hash(b.token()));
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    UUID g = (UUID) rows.getFirst().get("group_id");
    if (repository.hasMembership(g, user(j))) return group(j, g);
    checkGroupLimit(user(j));
    int capacity = repository.lockGroupCapacity(g);
    if (repository.countMembers(g) >= capacity)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "모임 정원(" + capacity + "명)이 가득 찼어요. 모임 소유자에게 최대 인원 변경을 요청해 주세요.");
    repository.insertMember(g, user(j));
    repository.markInviteUsed((UUID) rows.getFirst().get("id"));
    audit(g, user(j), "invite.join", user(j));
    return group(j, g);
  }
}
