"use client";
import { Button, Icon } from "@/shared/ui";
import { useRef, useState } from "react";
export function QuestionComposer({
  busy,
  disabled = false,
  groupName,
  onSend,
  onStop,
}: {
  busy: boolean;
  disabled?: boolean;
  groupName?: string;
  onSend: (question: string) => Promise<boolean>;
  onStop?: () => void;
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
        if (!text || busy || disabled) return;
        if (await onSend(text)) setQuestion("");
      }}
    >
      <label htmlFor="chat-question" className="sr-only">
        모임에 대해 모아AI에 질문하기
      </label>
      <textarea
        id="chat-question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={
          groupName
            ? `${groupName} 자료나 궁금한 내용을 물어보세요.`
            : "자료 내용이나 궁금한 내용을 물어보세요."
        }
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
          {busy ? "답변을 준비하고 있어요…" : "⌘ / Ctrl + Enter로 전송"}
        </span>
        {onStop ? (
          <Button type="button" variant="secondary" onClick={onStop}>
            답변 중지
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={disabled || !question.trim()}
            loading={busy}
          >
            <Icon name="arrow" size={17} />
            <span>질문 보내기</span>
          </Button>
        )}
      </div>
    </form>
  );
}
