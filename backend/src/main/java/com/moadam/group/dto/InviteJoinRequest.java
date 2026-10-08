package com.moadam.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

@Schema(name = "JoinInput")
public record InviteJoinRequest(@NotBlank @Size(max = 100) String token) {}
