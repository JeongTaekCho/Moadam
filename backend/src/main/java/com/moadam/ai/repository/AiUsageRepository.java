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
            + " coalesce((select used from ai_daily_usage where user_id=? and usage_date="
            + " (current_timestamp at time zone 'Asia/Seoul')::date),0) as used",
        user);
  }

  public List<Map<String, Object>> consume(UUID user) {
    return db.queryForList(
        "insert into ai_daily_usage(user_id,usage_date,used)"
            + " values(?,(current_timestamp at time zone 'Asia/Seoul')::date,1)"
            + " on conflict(user_id,usage_date) do update set used=ai_daily_usage.used+1"
            + " where ai_daily_usage.used<30 returning usage_date,used",
        user);
  }
}
