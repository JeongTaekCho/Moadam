package com.moadam.note.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "DocumentInput")
public record NoteUpdateRequest(
    @NotBlank @Size(max = 200) String title, @Size(max = 100000) String text) {}
