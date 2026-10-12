package com.moadam.event.service;

import java.time.Instant;
import java.time.ZoneId;

final class EventDatePolicy {
  private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

  private EventDatePolicy() {}

  static boolean isBeforeToday(Instant start, Instant now) {
    return start.atZone(KOREA).toLocalDate().isBefore(now.atZone(KOREA).toLocalDate());
  }
}
