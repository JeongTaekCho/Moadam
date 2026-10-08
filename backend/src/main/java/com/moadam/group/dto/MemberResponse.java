package com.moadam.group.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.moadam.person.dto.PublicProfile;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.*;

@Schema(name = "Member")
@JsonIgnoreProperties(ignoreUnknown = true)
public record MemberResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID user_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile profile,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = {"owner", "admin", "member"})
        String role,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}
