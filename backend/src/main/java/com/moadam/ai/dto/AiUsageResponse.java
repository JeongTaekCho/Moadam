package com.moadam.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record AiUsageResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int limit,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int used,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int remaining,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime resets_at) {}
