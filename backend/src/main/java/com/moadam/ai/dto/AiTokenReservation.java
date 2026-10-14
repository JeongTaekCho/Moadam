package com.moadam.ai.dto;

import java.util.UUID;

public record AiTokenReservation(UUID requestId, int tokenBudget) {}
