package com.moadam.person.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "ProfileInput")
public record PersonCreateRequest(@NotBlank @Size(max = 30) String display_name) {}
