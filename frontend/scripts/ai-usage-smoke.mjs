import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const moduleUrl = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  ).toString("base64");
const usageUrl = moduleUrl(
  await readFile("src/shared/api/ai-usage.ts", "utf8"),
);
const { parseAiUsage } = await import(usageUrl);
const counts = {
  limit_tokens: 120000,
  used_tokens: 30000,
  reserved_tokens: 5000,
  resets_at: "2026-10-15T00:00:00+09:00",
};
assert.equal(parseAiUsage(counts).remaining_percent, 75);
assert.equal(parseAiUsage(counts).available_tokens, 85000);
assert.equal(
  parseAiUsage({ ...counts, remaining_percent: undefined }).remaining_percent,
  75,
);
assert.equal(
  parseAiUsage({ ...counts, remaining_percent: 99 }).remaining_percent,
  75,
);
for (const [used, expected] of [
  [0, 100],
  [120000, 0],
  [120050, 0],
  [119999, 0],
])
  assert.equal(
    parseAiUsage({ ...counts, used_tokens: used }).remaining_percent,
    expected,
  );
for (const invalid of [
  null,
  {},
  { limit: 30, used: 1, remaining: 29, resets_at: counts.resets_at },
  { ...counts, limit_tokens: 0 },
  { ...counts, used_tokens: NaN },
  { ...counts, reserved_tokens: -1 },
  { ...counts, resets_at: "invalid" },
])
  assert.throws(() => parseAiUsage(invalid), /사용량을 확인하지 못했어요/);

const clientUrl = moduleUrl(
  "export class ApiError extends Error {}; export const getApiScope = () => 'test';",
);
const streamSource = (await readFile("src/shared/api/chat-stream.ts", "utf8"))
  .replace('from "./client"', `from "${clientUrl}"`)
  .replace('from "./ai-usage"', `from "${usageUrl}"`);
const { consumeChatStream } = await import(moduleUrl(streamSource));
const done = {
  type: "done",
  user: { id: "user" },
  assistant: { id: "assistant", content: "답변 완료" },
};
const events = [];
await consumeChatStream(
  new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          [
            { type: "usage", usage: counts },
            { type: "usage", usage: { limit: 30, remaining: 29 } },
            { type: "delta", text: "답변 완료" },
            done,
          ]
            .map((event) => JSON.stringify(event) + "\n")
            .join(""),
        ),
      );
      controller.close();
    },
  }),
  (event) => events.push(event),
);
assert.equal(events.length, 3);
assert.equal(events[0].usage.remaining_percent, 75);
assert.deepEqual(events.at(-1), done);
console.log(
  "PASS: missing percentages, authoritative token counts, exhausted allowance, invalid/legacy responses and stream usage without losing answers",
);
