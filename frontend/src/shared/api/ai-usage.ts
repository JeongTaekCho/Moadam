import type { components } from "./generated-api";

type AiUsage = components["schemas"]["AiUsageResponse"];

export function parseAiUsage(value: unknown): AiUsage {
  if (!value || typeof value !== "object")
    throw new Error("사용량을 확인하지 못했어요");
  const usage = value as Record<string, unknown>;
  const {
    limit_tokens: limit,
    used_tokens: used,
    reserved_tokens: reserved,
  } = usage;
  if (
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    typeof used !== "number" ||
    !Number.isSafeInteger(used) ||
    used < 0 ||
    typeof reserved !== "number" ||
    !Number.isSafeInteger(reserved) ||
    reserved < 0 ||
    typeof usage.resets_at !== "string" ||
    !Number.isFinite(Date.parse(usage.resets_at))
  )
    throw new Error("사용량을 확인하지 못했어요");

  // Counts are authoritative; never convert the old question quota into tokens.
  const remaining = Math.max(0, limit - used);
  const usedPercent = Math.min(100, Math.round((used / limit) * 1000) / 10);
  return {
    limit_tokens: limit,
    used_tokens: used,
    reserved_tokens: reserved,
    remaining_tokens: remaining,
    available_tokens: Math.max(0, remaining - reserved),
    used_percent: usedPercent,
    remaining_percent: Math.round((100 - usedPercent) * 10) / 10,
    resets_at: usage.resets_at,
  };
}
