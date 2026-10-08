"use client";
import type { Citation, Message } from "./model";
import { memo } from "react";

import { Icon, Markdown } from "@/shared/ui";
export function CitationList({
  citations,
  onOpen,
}: {
  citations: Citation[];
  onOpen: (id: string) => void;
}) {
  if (!citations.length) return null;
  return (
    <div className="citation-list">
      <p className="citation-label">답변의 근거 · 클릭해서 자료 확인</p>
      {citations.map((c) => (
        <button
          className="citation"
          key={c.chunk_id}
          onClick={() => onOpen(c.document_id)}
        >
          <Icon name="file" size={13} /> {c.title}
          {c.page ? ` · ${c.page}쪽` : ""}
        </button>
      ))}
    </div>
  );
}
export const ChatMessage = memo(function ChatMessage({
  message,
  onSource,
  streaming = false,
}: {
  message: Message;
  onSource: (id: string) => void;
  streaming?: boolean;
}) {
  return (
    <div className={`message ${message.role}`} aria-busy={streaming}>
      <small>
        {message.role === "assistant" && <Icon name="spark" size={14} />}{" "}
        {message.role === "user" ? "나" : "모아AI"}
        {streaming
          ? " · 답변 작성 중"
          : message.role === "assistant" && !message.grounded
            ? " · 자료에서 확인 필요"
            : ""}
      </small>
      {streaming ? (
        <p className="streaming-answer">
          {message.content}
          <span className="streaming-cursor" aria-hidden="true" />
        </p>
      ) : message.role === "assistant" ? (
        <Markdown text={message.content} />
      ) : (
        <p className="body">{message.content}</p>
      )}
      <CitationList citations={message.citations} onOpen={onSource} />
    </div>
  );
});
