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
  void reportsTokensAndPercentagesAtKoreanMidnightAndRejectsExhaustedAllowance() {
    var repository = mock(AiUsageRepository.class);
    var service = new AiUsageService(repository, 120000, 20000);
    var user = UUID.randomUUID();
    when(repository.current(user))
        .thenReturn(
            Map.of(
                "usage_date",
                Date.valueOf("2026-10-13"),
                "used_tokens",
                30000,
                "reserved_tokens",
                5000));
    var usage = service.current(user);
    assertEquals(75, usage.remaining_percent());
    assertEquals(25, usage.used_percent());
    assertEquals(85000, usage.available_tokens());
    assertEquals("2026-10-14T00:00+09:00", usage.resets_at().toString());
    when(repository.reserve(eq(user), any(), eq(120000), eq(20000)))
        .thenReturn(List.of(Map.of("allocated_tokens", 20000)));
    var ticket = service.reserve(user);
    assertEquals(20000, ticket.tokenBudget());
    service.finish(user, ticket);
    verify(repository).finish(user, ticket.requestId());
    when(repository.reserve(eq(user), any(), eq(120000), eq(20000))).thenReturn(List.of());
    assertEquals(
        429,
        assertThrows(ResponseStatusException.class, () -> service.reserve(user))
            .getStatusCode()
            .value());
    when(repository.current(user))
        .thenReturn(
            Map.of(
                "usage_date",
                Date.valueOf("2026-10-13"),
                "used_tokens",
                120050,
                "reserved_tokens",
                0));
    assertEquals(0, service.current(user).remaining_percent());
    assertEquals(0, service.current(user).available_tokens());
  }
}
