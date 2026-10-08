package com.moadam.person.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(name = "MyProfile")
public record PersonResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String display_name,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            types = {"string", "null"})
        String avatar_url,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}
