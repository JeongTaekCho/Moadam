"use client";
import type { Citation, Message } from "./model";
import { memo } from "react";

import { Icon, Markdown, MoaAiIcon } from "@/shared/ui";
export function CitationList({
  citations,
  onOpen,
}: {
  citations: Citation[];
  onOpen: (source: Citation) => void;
}) {
  if (!citations.length) return null;
  return (
    <div className="citation-list">
      <p className="citation-label">답변의 근거 · 클릭해서 원문 확인</p>
      {citations.map((c) => (
        <button className="citation" key={c.chunk_id} onClick={() => onOpen(c)}>
          <Icon
            name={c.source_type === "event" ? "calendar" : "file"}
            size={13}
          />
          {c.source_type === "event"
            ? "일정 · "
            : c.source_type === "notice"
              ? "공지 · "
              : ""}
          {c.title}
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
  onSource: (source: Citation) => void;
  streaming?: boolean;
}) {
  return (
    <div className={`message ${message.role}`} aria-busy={streaming}>
      <small>
        {message.role === "assistant" && <MoaAiIcon size={20} />}{" "}
        {message.role === "user" ? "나" : "모아AI"}
        {streaming ? " · 답변 작성 중" : ""}
      </small>
      {message.role === "assistant" ? (
        <>
          <Markdown text={message.content} />
          {streaming && (
            <span className="streaming-cursor" aria-hidden="true" />
          )}
        </>
      ) : (
        <p className="body">{message.content}</p>
      )}
      <CitationList citations={message.citations} onOpen={onSource} />
    </div>
  );
});
