package com.moadam.ai.repository;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AiRepository {
  private final JdbcTemplate db;

  public AiRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Map<String, Object> insertUserMessageReturning(UUID group, UUID session, String question) {
    return db.queryForMap(
        "insert into chat_messages(group_id,session_id,role,content) values(?,?,'user',?) returning"
            + " *",
        group,
        session,
        question);
  }

  public Map<String, Object> insertAssistantMessageReturning(
      UUID group, UUID session, String answer, String citations, boolean grounded) {
    return db.queryForMap(
        "insert into chat_messages(group_id,session_id,role,content,citations,grounded)"
            + " values(?,?,'assistant',?,?::jsonb,?) returning *",
        group,
        session,
        answer,
        citations,
        grounded);
  }

  public int insertUserMessage(UUID group, UUID session, String question) {
    return db.update(
        "insert into chat_messages(group_id,session_id,role,content) values(?,?,'user',?)",
        group,
        session,
        question);
  }

  public int insertAssistantMessage(
      UUID group, UUID session, String answer, String citations, boolean grounded) {
    return db.update(
        "insert into chat_messages(group_id,session_id,role,content,citations,grounded)"
            + " values(?,?,'assistant',?,?::jsonb,?)",
        group,
        session,
        answer,
        citations,
        grounded);
  }

  public int deleteOwnedSession(UUID group, UUID id, UUID user) {
    return db.update(
        "delete from chat_sessions where group_id=? and id=? and user_id=?", group, id, user);
  }

  public List<Map<String, Object>> findOwnedSession(UUID group, UUID id, UUID user) {
    return db.queryForList(
        "select * from chat_sessions where group_id=? and id=? and user_id=?", group, id, user);
  }

  public int insertSession(UUID id, UUID group, UUID user, String title) {
    return db.update(
        "insert into chat_sessions(id,group_id,user_id,title) values(?,?,?,?)",
        id,
        group,
        user,
        title);
  }
}
