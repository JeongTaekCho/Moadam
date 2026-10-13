package com.moadam.ai.service;

import com.moadam.ai.dto.AiUsageResponse;
import com.moadam.ai.repository.AiUsageRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AiUsageService {
  private final AiUsageRepository repository;

  public AiUsageService(AiUsageRepository repository) {
    this.repository = repository;
  }

  public AiUsageResponse current(UUID user) {
    return response(repository.current(user));
  }

  // Commit accepted attempts independently of generation/save failures.
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public AiUsageResponse consume(UUID user) {
    var rows = repository.consume(user);
    if (rows.isEmpty())
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "오늘의 모아AI 질문 30회를 모두 사용했어요. 한국 시간 자정 이후 다시 질문해 주세요.");
    return response(rows.getFirst());
  }

  private AiUsageResponse response(Map<String, Object> row) {
    int used = ((Number) row.get("used")).intValue();
    var date = LocalDate.parse(row.get("usage_date").toString());
    return new AiUsageResponse(
        30,
        used,
        30 - used,
        date.plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toOffsetDateTime());
  }
}
