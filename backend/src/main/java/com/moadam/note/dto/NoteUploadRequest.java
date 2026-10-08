package com.moadam.note.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "UploadInput")
public record NoteUploadRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 200) String filename,
    @NotNull @Pattern(regexp = "application/pdf") String mime,
    @Min(1) @Max(20971520) long size) {}
