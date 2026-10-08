package com.moadam.person.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(name = "PublicProfile")
public record PublicProfile(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String display_name,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            types = {"string", "null"})
        String avatar_url) {}
