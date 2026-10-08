package com.moadam.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.*;

@Schema(name = "Citation")
public record Citation(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID document_id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            types = {"integer", "null"})
        Integer page,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID chunk_id) {}
