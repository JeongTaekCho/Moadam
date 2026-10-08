package com.moadam.person.entity;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

public record Person(
    UUID id, String displayName, String avatarPath, Instant accountCreatedAt, Instant updatedAt) {
  public static Person fromRow(Map<String, Object> row) {
    return new Person(
        (UUID) row.get("id"),
        Objects.toString(row.get("display_name"), ""),
        (String) row.get("avatar_path"),
        instant(row.get("account_created_at")),
        instant(row.get("updated_at")));
  }

  private static Instant instant(Object value) {
    return value instanceof Timestamp t ? t.toInstant() : (Instant) value;
  }
}
