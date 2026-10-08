package com.moadam.event.repository;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EventRepository {
  private final JdbcTemplate db;

  public EventRepository(JdbcTemplate db) {
    this.db = db;
  }

  public int upsertAttendance(UUID group, UUID event, UUID user, String status) {
    return db.update(
        "insert into event_attendees(group_id,event_id,user_id,status) values(?,?,?,?) on"
            + " conflict(group_id,event_id,user_id) do update set status=excluded.status",
        group,
        event,
        user,
        status);
  }

  public List<Map<String, Object>> findAttendance(UUID group, UUID event) {
    return db.queryForList(
        "select user_id,status from event_attendees where group_id=? and event_id=?", group, event);
  }

  public int deleteEvent(UUID group, UUID id) {
    return db.update("delete from events where group_id=? and id=?", group, id);
  }

  public int updateEvent(
      String title,
      String description,
      String location,
      java.sql.Timestamp startsAt,
      java.sql.Timestamp endsAt,
      UUID group,
      UUID id) {
    return db.update(
        "update events set title=?,description=?,location=?,starts_at=?,ends_at=? where group_id=?"
            + " and id=?",
        title,
        description,
        location,
        startsAt,
        endsAt,
        group,
        id);
  }

  public int insertEvent(
      UUID id,
      UUID group,
      UUID author,
      String title,
      String description,
      String location,
      java.sql.Timestamp startsAt,
      java.sql.Timestamp endsAt) {
    return db.update(
        "insert into events(id,group_id,author_id,title,description,location,starts_at,ends_at)"
            + " values(?,?,?,?,?,?,?,?)",
        id,
        group,
        author,
        title,
        description,
        location,
        startsAt,
        endsAt);
  }
}
