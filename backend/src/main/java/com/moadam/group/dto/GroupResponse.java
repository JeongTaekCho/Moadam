package com.moadam.group.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(name = "Group")
@JsonIgnoreProperties(ignoreUnknown = true)
public record GroupResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String timezone,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = {"owner", "admin", "member"})
        String role,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1", maximum = "30")
        int max_members,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int member_count,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}
