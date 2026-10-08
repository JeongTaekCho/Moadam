package com.moadam.person.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(name = "MyActivity")
public record PersonActivityResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String group_name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}
