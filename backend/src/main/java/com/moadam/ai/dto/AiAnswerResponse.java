package com.moadam.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.*;

@Schema(name = "Answer")
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiAnswerResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String answer,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Citation> citations,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean grounded,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double confidence,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String provider,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<String, Object> retrieval,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID request_id) {}
