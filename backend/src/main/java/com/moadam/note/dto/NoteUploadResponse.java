package com.moadam.note.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "Upload")
public record NoteUploadResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) NoteResponse document,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String upload_url,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int expires_in) {}
