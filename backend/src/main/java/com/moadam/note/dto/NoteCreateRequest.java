package com.moadam.note.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

@Schema(name = "MemoInput")
public record NoteCreateRequest(
    @NotBlank @Size(max = 200) String title,
    @NotNull @Pattern(regexp = "memo") String kind,
    @NotBlank @Size(max = 100000) String text) {}
