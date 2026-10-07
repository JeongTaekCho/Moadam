"use client";
import { Button, Icon } from "@/shared/ui";
import { useRef, useState } from "react";
export function QuestionComposer({
  busy,
  onSend,
}: {
  busy: boolean;
  onSend: (question: string) => Promise<boolean>;
}) {
  const [question, setQuestion] = useState("");
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      className="question-composer"
      ref={form}
      onSubmit={async (e) => {
        e.preventDefault();
        const text = question.trim();
        if (!text || busy) return;
        if (await onSend(text)) setQuestion("");
      }}
    >
      <label htmlFor="chat-question" className="sr-only">
        모임 자료에 질문하기
      </label>
      <textarea
        id="chat-question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="모임 자료에서 무엇이 궁금하세요?"
        maxLength={4000}
        required
        disabled={busy}
        rows={2}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            form.current?.requestSubmit();
          }
        }}
      />
      <div className="composer-footer">
        <span>
          {busy
            ? "자료를 찾고 답변을 정리하고 있어요…"
            : "⌘ / Ctrl + Enter로 전송"}
        </span>
        <Button type="submit" disabled={!question.trim()} loading={busy}>
          <Icon name="arrow" size={17} />
          <span>질문 보내기</span>
        </Button>
      </div>
    </form>
  );
}
