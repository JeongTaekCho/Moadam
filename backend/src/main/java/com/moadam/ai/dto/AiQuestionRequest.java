package com.moadam.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "QuestionInput")
public record AiQuestionRequest(@NotBlank @Size(max = 4000) String question) {}
