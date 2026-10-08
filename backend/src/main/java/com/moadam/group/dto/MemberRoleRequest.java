package com.moadam.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Schema(name = "RoleInput")
public record MemberRoleRequest(@NotNull @Pattern(regexp = "admin|member") String role) {}
