package com.moadam.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "SessionInput")
public record AiSessionCreateRequest(@NotBlank @Size(max = 100) String title) {}
