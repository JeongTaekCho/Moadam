package com.moadam.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "GroupInput")
public record GroupCreateRequest(
    @NotBlank @Size(max = 100) String name,
    @NotBlank String timezone,
    @Min(1)
        @Max(30)
        @Schema(description = "소유자를 포함한 최대 인원 (1~30명). 생성 시 생략하면 30명, 수정 시 생략하면 기존 값 유지")
        Integer max_members) {
  public GroupCreateRequest(String name, String timezone) {
    this(name, timezone, null);
  }
}
