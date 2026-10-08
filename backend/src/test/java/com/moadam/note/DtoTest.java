package com.moadam.note;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.moadam.note.dto.NoteResponse;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class DtoTest {
  @Test
  void jdbcTimestampConvertsToUtcAndPrivateColumnsDoNotEscape() {
    var json =
        new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    var instant = Instant.parse("2026-10-07T10:00:00Z");
    var row = new HashMap<String, Object>();
    row.put("id", UUID.randomUUID());
    row.put("created_at", Timestamp.from(instant));
    row.put("storage_path", "private/path");
    var dto = json.convertValue(row, NoteResponse.class);
    assertEquals(instant, dto.created_at());
    assertFalse(json.valueToTree(dto).has("storage_path"));
  }
}
