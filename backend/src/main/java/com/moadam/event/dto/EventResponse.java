package com.moadam.event.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.moadam.person.dto.PublicProfile;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.*;

@Schema(name = "Event")
@JsonIgnoreProperties(ignoreUnknown = true)
public record EventResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID author_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile author,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String description,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String location,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant starts_at,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant ends_at,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}
