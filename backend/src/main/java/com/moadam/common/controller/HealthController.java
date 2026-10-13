package com.moadam.common.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
public class HealthController {
  private final JdbcTemplate db;

  public HealthController(JdbcTemplate db) {
    this.db = db;
  }

  @GetMapping("/healthz")
  public Map<String, String> live() {
    return Map.of("status", "ok");
  }

  @GetMapping("/readyz")
  public ResponseEntity<Map<String, String>> ready() {
    try {
      Boolean ready =
          db.queryForObject(
              "select to_regclass('public.document_jobs') is not null and to_regclass('public.ai_daily_usage') is not null",
              Boolean.class);
      return ResponseEntity.status(Boolean.TRUE.equals(ready) ? 200 : 503)
          .header("Cache-Control", "no-store")
          .body(Map.of("status", Boolean.TRUE.equals(ready) ? "ready" : "unavailable"));
    } catch (Exception e) {
      return ResponseEntity.status(503)
          .header("Cache-Control", "no-store")
          .body(Map.of("status", "unavailable"));
    }
  }
}
