package com.moadam.group.controller;

import com.moadam.common.dto.Page;
import com.moadam.group.dto.GroupCreateRequest;
import com.moadam.group.dto.GroupResponse;
import com.moadam.group.dto.InviteJoinRequest;
import com.moadam.group.dto.InviteResponse;
import com.moadam.group.dto.MemberResponse;
import com.moadam.group.dto.MemberRoleRequest;
import com.moadam.group.service.GroupService;
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
public class GroupController {
  private final GroupService service;

  public GroupController(GroupService service) {
    this.service = service;
  }

  @GetMapping("/groups")
  public Page<GroupResponse> groups(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.groups(j, page, size);
  }

  @PostMapping("/groups")
  public GroupResponse createGroup(
      @AuthenticationPrincipal Jwt j, @Valid @RequestBody GroupCreateRequest b) {
    return service.createGroup(j, b);
  }

  @GetMapping("/groups/{g}")
  public GroupResponse group(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    return service.group(j, g);
  }

  @PatchMapping("/groups/{g}")
  public GroupResponse updateGroup(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @Valid @RequestBody GroupCreateRequest b) {
    return service.updateGroup(j, g, b);
  }

  @DeleteMapping("/groups/{g}")
  public Map<String, Boolean> deleteGroup(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    return service.deleteGroup(j, g);
  }

  @GetMapping("/groups/{g}/members")
  public Page<MemberResponse> members(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.members(j, g, page, size);
  }

  @PatchMapping("/groups/{g}/members/{id}")
  public Map<String, Boolean> role(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody MemberRoleRequest b) {
    return service.role(j, g, id, b);
  }

  @DeleteMapping("/groups/{g}/members/{id}")
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.remove(j, g, id);
  }

  @DeleteMapping("/groups/{g}/membership")
  public Map<String, Boolean> leave(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    return service.leave(j, g);
  }

  @GetMapping("/groups/{g}/invites")
  public Page<InviteResponse> invites(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.invites(j, g, page, size);
  }

  @PostMapping("/groups/{g}/invites")
  public Map<String, Object> invite(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    return service.invite(j, g);
  }

  @DeleteMapping("/groups/{g}/invites/{id}")
  public Map<String, Boolean> revoke(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    return service.revoke(j, g, id);
  }

  @PostMapping("/invites/join")
  public GroupResponse join(
      @AuthenticationPrincipal Jwt j, @Valid @RequestBody InviteJoinRequest b) {
    return service.join(j, b);
  }
}
