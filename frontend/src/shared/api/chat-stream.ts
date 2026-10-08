import { ApiError, getApiScope, type Message } from "./client";

export type ChatStreamEvent =
  | { type: "status"; stage: "retrieving" | "generating" | "saving" }
  | { type: "delta"; text: string }
  | { type: "done"; user: Message; assistant: Message }
  | { type: "error"; message: string };

export async function consumeChatStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    completed = false;
  function line(value: string) {
    if (!value.trim()) return;
    if (completed) throw new Error("완료 이후 잘못된 응답이 도착했습니다");
    const event = JSON.parse(value) as ChatStreamEvent;
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "delta" && typeof event.text !== "string")
      throw new Error("잘못된 답변 형식입니다");
    if (event.type === "done") {
      if (
        !event.user?.id ||
        !event.assistant?.id ||
        typeof event.assistant.content !== "string"
      )
        throw new Error("완료된 답변을 확인하지 못했습니다");
      completed = true;
    }
    onEvent(event);
  }
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      if (buffer.length > 100000)
        throw new Error("답변 크기 제한을 초과했습니다");
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (done) break;
    }
    if (buffer.trim()) line(buffer);
    if (!completed)
      throw new Error("답변 연결이 끊어졌습니다. 다시 시도해 주세요.");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamQuestion(
  path: string,
  question: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal: AbortSignal,
) {
  const scope = getApiScope();
  const response = await fetch(`/api/proxy/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.message || "답변을 요청하지 못했습니다",
    );
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.startsWith("application/x-ndjson")
  )
    throw new Error("스트리밍 응답을 확인하지 못했습니다");
  await consumeChatStream(
    response.body,
    (event) => {
      if (scope !== getApiScope())
        throw new DOMException("Stale group response", "AbortError");
      onEvent(event);
    },
    signal,
  );
}
