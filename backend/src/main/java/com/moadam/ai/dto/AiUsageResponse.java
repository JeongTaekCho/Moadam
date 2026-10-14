package com.moadam.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record AiUsageResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long limit_tokens,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long used_tokens,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long reserved_tokens,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long remaining_tokens,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long available_tokens,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double used_percent,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double remaining_percent,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime resets_at) {}
