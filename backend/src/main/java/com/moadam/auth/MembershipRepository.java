package com.moadam.auth;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MembershipRepository {
  private final JdbcTemplate db;

  public MembershipRepository(JdbcTemplate db) {
    this.db = db;
  }

  public List<Map<String, Object>> findRole(UUID group, UUID user) {
    return db.queryForList(
        "select role from group_members where group_id=? and user_id=?", group, user);
  }
}
