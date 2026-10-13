package com.moadam.note;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.moadam.common.controller.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class HealthTest {
  @Test
  void readinessFailsClosedWithoutLeakingConnectionDetails() {
    var db = mock(JdbcTemplate.class);
    var health = new HealthController(db);
    when(db.queryForObject(anyString(), eq(Boolean.class)))
        .thenReturn(true, false)
        .thenThrow(new IllegalStateException("private"));
    assertEquals(200, health.ready().getStatusCode().value());
    assertEquals(503, health.ready().getStatusCode().value());
    assertEquals(java.util.Map.of("status", "unavailable"), health.ready().getBody());
    assertEquals(java.util.Map.of("status", "ok"), health.live());
  }
}
