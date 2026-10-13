package com.moadam.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.moadam.ai.repository.AiUsageRepository;
import com.moadam.ai.service.AiUsageService;
import java.sql.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AiUsageTest {
  @Test
  void reportsKoreanMidnightAndRejectsExhaustedAllowance() {
    var repository = mock(AiUsageRepository.class);
    var service = new AiUsageService(repository);
    var user = UUID.randomUUID();
    when(repository.current(user))
        .thenReturn(Map.of("usage_date", Date.valueOf("2026-10-13"), "used", 0));
    assertEquals(30, service.current(user).remaining());
    assertEquals("2026-10-14T00:00+09:00", service.current(user).resets_at().toString());
    when(repository.consume(user))
        .thenReturn(List.of(Map.of("usage_date", Date.valueOf("2026-10-13"), "used", 30)));
    assertEquals(0, service.consume(user).remaining());
    when(repository.consume(user)).thenReturn(List.of());
    assertEquals(
        429,
        assertThrows(ResponseStatusException.class, () -> service.consume(user))
            .getStatusCode()
            .value());
  }
}
