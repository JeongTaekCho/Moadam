package com.moadam.post.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

@Schema(name = "CommentInput")
public record CommentCreateRequest(@NotBlank @Size(max = 5000) String body) {}
