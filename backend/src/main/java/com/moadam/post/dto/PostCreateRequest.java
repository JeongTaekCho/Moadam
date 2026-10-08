package com.moadam.post.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "PostInput")
public record PostCreateRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 20000) String body,
    @Pattern(regexp = "general|question|notice") @NotNull String kind) {}
