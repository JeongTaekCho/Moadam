package com.moadam.ai.repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AiUsageRepository {
  private final JdbcTemplate db;

  public AiUsageRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Map<String, Object> current(UUID user) {
    return db.queryForMap(
        "select (current_timestamp at time zone 'Asia/Seoul')::date as usage_date,"
            + " coalesce(d.used_tokens,0) as used_tokens,coalesce(d.reserved_tokens,0) as reserved_tokens"
            + " from (select 1) seed left join ai_daily_token_usage d on d.user_id=? and"
            + " d.usage_date=(current_timestamp at time zone 'Asia/Seoul')::date",
        user);
  }

  public List<Map<String, Object>> reserve(UUID user, UUID request, int limit, int requestLimit) {
    return db.queryForList(
        "select * from ai_reserve_tokens(?,?,?,?)", user, request, limit, requestLimit);
  }

  public void cancel(UUID user, UUID request) {
    db.queryForObject("select ai_finish_tokens(?,?,true)", Object.class, request, user);
  }

  public void finish(UUID user, UUID request) {
    db.queryForObject("select ai_finish_tokens(?,?)", Object.class, request, user);
  }
}
