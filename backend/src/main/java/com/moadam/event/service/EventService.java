package com.moadam.event.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.ai.client.*;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import com.moadam.event.dto.AttendanceRequest;
import com.moadam.event.dto.EventCreateRequest;
import com.moadam.event.dto.EventResponse;
import com.moadam.event.repository.EventRepository;
import jakarta.validation.constraints.*;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@Service
public class EventService extends DomainService {
  private final EventRepository repository;

  public EventService(
      EventRepository repository,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json) {
    super(resources, mapper, policy, json);
    this.repository = repository;
  }

  public Page<EventResponse> events(Jwt j, UUID g, int page, int size, Instant from) {
    policy.member(g, user(j));
    return typed(
        from == null
            ? page("events", g, page, size, "")
            : page("events", g, page, size, "and ends_at>=?", java.sql.Timestamp.from(from)),
        EventResponse.class);
  }

  public EventResponse event(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    return dto(EventResponse.class, one("events", g, id));
  }

  void validateEvent(EventCreateRequest b) {
    if (!b.ends_at().isAfter(b.starts_at())) throw new IllegalArgumentException();
  }

  @Transactional
  public EventResponse createEvent(Jwt j, UUID g, EventCreateRequest b) {
    policy.member(g, user(j));
    validateEvent(b);
    UUID id = UUID.randomUUID();
    repository.insertEvent(
        id,
        g,
        user(j),
        b.title(),
        Objects.toString(b.description(), ""),
        Objects.toString(b.location(), ""),
        java.sql.Timestamp.from(b.starts_at()),
        java.sql.Timestamp.from(b.ends_at()));
    audit(g, user(j), "event.create", id);
    return dto(EventResponse.class, one("events", g, id));
  }

  @Transactional
  public EventResponse updateEvent(Jwt j, UUID g, UUID id, EventCreateRequest b) {
    edit("events", g, id, user(j));
    validateEvent(b);
    repository.updateEvent(
        b.title(),
        Objects.toString(b.description(), ""),
        Objects.toString(b.location(), ""),
        java.sql.Timestamp.from(b.starts_at()),
        java.sql.Timestamp.from(b.ends_at()),
        g,
        id);
    audit(g, user(j), "event.update", id);
    return dto(EventResponse.class, one("events", g, id));
  }

  @Transactional
  public Map<String, Boolean> deleteEvent(Jwt j, UUID g, UUID id) {
    edit("events", g, id, user(j));
    repository.deleteEvent(g, id);
    audit(g, user(j), "event.delete", id);
    return Map.of("deleted", true);
  }

  public List<Map<String, Object>> attendance(Jwt j, UUID g, UUID id) {
    policy.member(g, user(j));
    one("events", g, id);
    return repository.findAttendance(g, id);
  }

  public Map<String, Boolean> attend(Jwt j, UUID g, UUID id, AttendanceRequest b) {
    policy.member(g, user(j));
    one("events", g, id);
    repository.upsertAttendance(g, id, user(j), b.status());
    return Map.of("updated", true);
  }
}
