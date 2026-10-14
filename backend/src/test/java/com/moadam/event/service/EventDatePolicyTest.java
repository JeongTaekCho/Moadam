package com.moadam.event.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.event.dto.AttendanceRequest;
import com.moadam.event.dto.EventCreateRequest;
import com.moadam.event.repository.EventRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

class EventDatePolicyTest {
  @Test
  void followsKoreanCalendarDateRatherThanUtcDateOrStartTime() {
    Instant now = Instant.parse("2026-10-11T15:00:00Z");
    assertTrue(EventDatePolicy.isBeforeToday(Instant.parse("2026-10-11T14:59:59Z"), now));
    assertFalse(EventDatePolicy.isBeforeToday(Instant.parse("2026-10-11T15:00:00Z"), now));
    assertFalse(EventDatePolicy.isBeforeToday(now, Instant.parse("2026-10-12T14:59:59Z")));
    assertTrue(EventDatePolicy.isBeforeToday(now, Instant.parse("2026-10-12T15:00:00Z")));
  }

  @Test
  void deniesPastAttendanceWithoutWritingAndAllowsToday() {
    var repository = mock(EventRepository.class);
    var resources = mock(ResourceRepository.class);
    var policy = mock(MembershipPolicy.class);
    var service =
        new EventService(repository, resources, mock(DtoMapper.class), policy, new ObjectMapper());
    UUID user = UUID.randomUUID(), group = UUID.randomUUID(), id = UUID.randomUUID();
    Jwt jwt = Jwt.withTokenValue("fixture").header("alg", "none").subject(user.toString()).build();
    Instant today =
        LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
    when(resources.one("events", group, id))
        .thenReturn(Map.of("starts_at", Timestamp.from(today.minusSeconds(1))));
    var response =
        assertThrows(
            ResponseStatusException.class,
            () -> service.attend(jwt, group, id, new AttendanceRequest("going")));
    assertEquals(409, response.getStatusCode().value());
    verify(repository, never()).upsertAttendance(any(), any(), any(), any());
    when(resources.one("events", group, id)).thenReturn(Map.of("starts_at", Timestamp.from(today)));
    service.attend(jwt, group, id, new AttendanceRequest("going"));
    verify(repository).upsertAttendance(group, id, user, "going");
    var dateError =
        assertThrows(
            ResponseStatusException.class,
            () ->
                service.validateEvent(
                    new EventCreateRequest("fixture", "", "", today.minusSeconds(86400), today)));
    assertEquals(400, dateError.getStatusCode().value());
    assertEquals("시작일이 오늘보다 전입니다. 시작일을 오늘 또는 이후 날짜로 수정해 주세요.", dateError.getReason());
    assertDoesNotThrow(
        () ->
            service.validateEvent(
                new EventCreateRequest("fixture", "", "", today, today.plusSeconds(3600))));
  }
}
