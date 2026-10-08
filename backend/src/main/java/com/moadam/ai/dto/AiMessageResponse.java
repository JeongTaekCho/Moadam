package com.moadam.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(name = "Message")
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiMessageResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID session_id,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = {"user", "assistant"})
        String role,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String content,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Citation> citations,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean grounded,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}
