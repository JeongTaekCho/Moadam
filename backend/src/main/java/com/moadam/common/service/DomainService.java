package com.moadam.common.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.*;
import com.moadam.common.repository.ResourceRepository;
import java.util.*;
import org.springframework.security.oauth2.jwt.Jwt;

public abstract class DomainService {
  protected final ResourceRepository resources;
  protected final DtoMapper mapper;
  protected final MembershipPolicy policy;
  protected final ObjectMapper json;

  protected DomainService(
      ResourceRepository resources, DtoMapper mapper, MembershipPolicy policy, ObjectMapper json) {
    this.resources = resources;
    this.mapper = mapper;
    this.policy = policy;
    this.json = json;
  }

  protected UUID user(Jwt jwt) {
    return UUID.fromString(jwt.getSubject());
  }

  protected Map<String, Object> one(String table, UUID group, UUID id) {
    return resources.one(table, group, id);
  }

  protected Page<Map<String, Object>> page(
      String table, UUID group, int page, int size, String condition, Object... args) {
    return resources.page(table, group, page, size, condition, args);
  }

  protected void audit(UUID group, UUID user, String action, UUID id) {
    resources.audit(group, user, action, id);
  }

  protected <T> T dto(Class<T> type, Map<String, Object> row) {
    return mapper.dto(type, row);
  }

  protected <T> Page<T> typed(Page<Map<String, Object>> page, Class<T> type) {
    return mapper.typed(page, type);
  }

  protected void edit(String table, UUID group, UUID id, UUID user) {
    policy.member(group, user);
    var row = one(table, group, id);
    policy.author(group, user, row.get("author_id"));
    if (table.equals("posts") && row.get("kind").equals("notice")) policy.admin(group, user);
  }
}
