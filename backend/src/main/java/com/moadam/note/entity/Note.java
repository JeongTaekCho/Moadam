package com.moadam.note.entity;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Full persistence row, including private Storage path. Never returned directly by a controller.
 */
public record Note(
    UUID id,
    UUID groupId,
    UUID authorId,
    String title,
    String kind,
    String text,
    String storagePath,
    int version,
    String status,
    String errorCode,
    Long sizeBytes,
    Instant createdAt,
    Instant updatedAt) {
  public static Note fromRow(Map<String, Object> row) {
    return new Note(
        (UUID) row.get("id"),
        (UUID) row.get("group_id"),
        (UUID) row.get("author_id"),
        (String) row.get("title"),
        (String) row.get("kind"),
        (String) row.get("text_content"),
        (String) row.get("storage_path"),
        ((Number) row.get("version")).intValue(),
        (String) row.get("status"),
        (String) row.get("error_code"),
        row.get("size_bytes") == null ? null : ((Number) row.get("size_bytes")).longValue(),
        instant(row.get("created_at")),
        instant(row.get("updated_at")));
  }

  private static Instant instant(Object value) {
    return value instanceof Timestamp t ? t.toInstant() : (Instant) value;
  }

  public Map<String, Object> toRow() {
    var row = new LinkedHashMap<String, Object>();
    row.put("id", id);
    row.put("group_id", groupId);
    row.put("author_id", authorId);
    row.put("title", title);
    row.put("kind", kind);
    row.put("text_content", text);
    row.put("storage_path", storagePath);
    row.put("version", version);
    row.put("status", status);
    row.put("error_code", errorCode);
    row.put("size_bytes", sizeBytes);
    row.put("created_at", createdAt);
    row.put("updated_at", updatedAt);
    return row;
  }
}
