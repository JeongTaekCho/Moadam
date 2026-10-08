package com.moadam.event.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

@Schema(name = "EventInput")
public record EventCreateRequest(
    @NotBlank @Size(max = 200) String title,
    @Size(max = 10000) String description,
    @Size(max = 500) String location,
    @NotNull Instant starts_at,
    @NotNull Instant ends_at) {}
