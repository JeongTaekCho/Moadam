package com.moadam.note.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.moadam.person.dto.PublicProfile;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.*;

@Schema(name = "Document")
@JsonIgnoreProperties(ignoreUnknown = true)
public record NoteResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID author_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile author,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = {"pdf", "memo"})
        String kind,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            types = {"string", "null"})
        String text_content,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = {"pending", "processing", "ready", "failed"})
        String status,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            types = {"string", "null"})
        String error_code,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int version,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            types = {"integer", "null"})
        Long size_bytes,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}
