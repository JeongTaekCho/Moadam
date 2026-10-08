package com.moadam.event.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

@Schema(name = "AttendanceInput")
public record AttendanceRequest(
    @NotNull @Pattern(regexp = "going|not_going|maybe") String status) {}
