package com.moadam.ai.service;

import com.moadam.ai.dto.AiTokenReservation;
import com.moadam.ai.dto.AiUsageResponse;
import com.moadam.ai.repository.AiUsageRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AiUsageService {
  private final AiUsageRepository repository;
  private final int dailyBudget;
  private final int requestBudget;

  public AiUsageService(
      AiUsageRepository repository,
      @Value("${app.ai.daily-token-budget:120000}") int dailyBudget,
      @Value("${app.ai.request-token-budget:20000}") int requestBudget) {
    if (dailyBudget < 1 || requestBudget < 1)
      throw new IllegalArgumentException("Invalid AI token budget");
    this.repository = repository;
    this.dailyBudget = dailyBudget;
    this.requestBudget = requestBudget;
  }

  public AiUsageResponse current(UUID user) {
    return response(repository.current(user));
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public AiTokenReservation reserve(UUID user) {
    UUID request = UUID.randomUUID();
    var rows = repository.reserve(user, request, dailyBudget, requestBudget);
    if (rows.isEmpty())
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS,
          "오늘 사용 가능한 모아AI 사용량이 부족해요. 다른 답변이 작성 중이면 잠시 기다리거나, 한국 시간 자정 이후 다시 질문해 주세요.");
    return new AiTokenReservation(
        request, ((Number) rows.getFirst().get("allocated_tokens")).intValue());
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void finish(UUID user, AiTokenReservation reservation) {
    repository.finish(user, reservation.requestId());
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void cancel(UUID user, AiTokenReservation reservation) {
    repository.cancel(user, reservation.requestId());
  }

  private AiUsageResponse response(Map<String, Object> row) {
    long used = ((Number) row.get("used_tokens")).longValue();
    long reserved = ((Number) row.get("reserved_tokens")).longValue();
    long remaining = Math.max(0, dailyBudget - used);
    double usedPercent = Math.min(100, Math.round(used * 1000.0 / dailyBudget) / 10.0);
    var date = LocalDate.parse(row.get("usage_date").toString());
    return new AiUsageResponse(
        dailyBudget,
        used,
        reserved,
        remaining,
        Math.max(0, remaining - reserved),
        usedPercent,
        Math.round((100 - usedPercent) * 10) / 10.0,
        date.plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toOffsetDateTime());
  }
}
