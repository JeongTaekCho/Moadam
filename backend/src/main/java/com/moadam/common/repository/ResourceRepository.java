package com.moadam.common.repository;

import com.moadam.common.dto.Page;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class ResourceRepository {
  private final JdbcTemplate db;

  public ResourceRepository(JdbcTemplate db) {
    this.db = db;
  }

  private void validateTable(String table) {
    if (!Set.of(
            "posts",
            "comments",
            "events",
            "documents",
            "chat_sessions",
            "chat_messages",
            "group_members",
            "group_invites")
        .contains(table)) throw new IllegalArgumentException("Unknown resource table");
  }

  public Map<String, Object> one(String table, UUID g, UUID id) {
    validateTable(table);
    var rows = db.queryForList("select * from " + table + " where group_id=? and id=?", g, id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return rows.getFirst();
  }

  public Page<Map<String, Object>> page(
      String table, UUID g, int page, int size, String condition, Object... extra) {
    validateTable(table);
    if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException();
    var args = new ArrayList<Object>();
    args.add(g);
    args.addAll(Arrays.asList(extra));
    Long total =
        db.queryForObject(
            "select count(*) from " + table + " where group_id=? " + condition,
            Long.class,
            args.toArray());
    args.add(size);
    args.add((long) page * size);
    return new Page<>(
        db.queryForList(
            "select * from "
                + table
                + " where group_id=? "
                + condition
                + " order by "
                + (table.equals("posts")
                    ? "(kind='notice') desc, created_at desc"
                    : table.equals("events")
                        ? "starts_at asc"
                        : table.equals("chat_messages")
                            ? "sequence asc"
                            : List.of("documents", "chat_sessions", "group_invites").contains(table)
                                ? "created_at desc"
                                : "created_at asc")
                + " limit ? offset ?",
            args.toArray()),
        page,
        size,
        total);
  }

  public void audit(UUID g, UUID u, String action, UUID id) {
    db.update(
        "insert into audit_logs(group_id,actor_id,action,resource_id) values(?,?,?,?)",
        g,
        u,
        action,
        id);
  }
}
