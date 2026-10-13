"use client";
import type { Message } from "@/entities/chat";
import { ChatMessage } from "@/entities/chat";
import { QuestionComposer } from "@/features/ask-question";
import { api, type Page, type AiUsage } from "@/shared/api";

import { Button, Icon, MoaAiIcon, PageIllustration } from "@/shared/ui";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ContentSkeleton } from "@/shared/ui/skeleton";
import type { WorkspaceModel } from "../model/use-workspace";
export function ChatView({ model: m }: { model: WorkspaceModel }) {
  const [usageError, setUsageError] = useState(false);
  const [usageReload, setUsageReload] = useState(0);
  const setUsage = m.setAiUsage;
  useEffect(() => {
    if (!m.signed || !m.me || m.busy) return;
    const controller = new AbortController();
    const refresh = () => {
      void api<AiUsage>("me/ai-usage", "GET", undefined, controller.signal)
        .then((usage) => {
          setUsage(usage);
          setUsageError(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setUsageError(true);
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [m.signed, m.me, m.busy, usageReload, setUsage]);
  useEffect(() => {
    if (!m.aiUsage?.resets_at) return;
    const delay = Math.max(
      1000,
      Date.parse(m.aiUsage.resets_at) - Date.now() + 1000,
    );
    const timer = window.setTimeout(
      () => setUsageReload((value) => value + 1),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [m.aiUsage?.resets_at, usageReload]);
  const exhausted = m.aiUsage?.remaining === 0;
  const viewport = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const openDocument = useRef(m.openDocument);
  useEffect(() => {
    openDocument.current = m.openDocument;
  }, [m.openDocument]);
  const onSource = useCallback((id: string) => {
    void openDocument.current(id);
  }, []);
  const scrollToLatest = useCallback(() => {
    if (follow.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, []);
  useLayoutEffect(() => {
    follow.current = true;
    scrollToLatest();
    // The assistant dialog may become visible after this component mounts.
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [m.sessionId, m.groupId, scrollToLatest]);
  useLayoutEffect(scrollToLatest, [m.messages, m.busy, scrollToLatest]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollToLatest]);
  return (
    <section className="chat-workspace">
      <aside className="conversation-sidebar">
        <div className="section-heading">
          <h2>내 대화</h2>
          <Button
            size="small"
            variant="ghost"
            disabled={m.busy}
            aria-label="새 대화 시작"
            onClick={m.startConversation}
          >
            <Icon name="plus" size={18} />
          </Button>
        </div>
        <p className="conversation-caption">나에게만 보이는 개인 대화</p>
        <div className="conversation-list">
          {m.assistantLoading && !m.sessions.length ? (
            <ContentSkeleton view="멤버" label="대화 목록을 불러오고 있어요" />
          ) : m.sessions.length ? (
            m.sessions.map((s) => (
              <button
                className={m.sessionId === s.id ? "active" : ""}
                key={s.id}
                disabled={m.busy}
                onClick={() => {
                  follow.current = true;
                  void m.openSession(s.id);
                }}
              >
                <Icon name="chat" size={16} />
                <span>
                  {s.title}
                  <small>
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="muted">
              첫 질문을 보내면
              <br />
              대화가 여기에 저장돼요.
            </p>
          )}
        </div>
        <button
          className="chat-library-link"
          onClick={() => m.changeView("자료")}
        >
          <Icon name="file" size={18} />
          <span>모임 자료</span>
          <Icon name="arrow" size={15} />
        </button>
      </aside>
      <div className="chat-panel">
        <div className="chat-panel-header">
          <span className="row">
            <MoaAiIcon size={24} />
            모아AI
          </span>
          <div className="row">
            <span className="chat-private">
              <Icon name="lock" size={13} />
              개인 대화
            </span>
            {m.sessionId && (
              <Button
                size="small"
                variant="ghost"
                disabled={m.busy}
                onClick={() =>
                  m.setConfirm({
                    title: "대화를",
                    path: `${m.base}/chat/sessions/${m.sessionId}`,
                    after: () => {
                      m.setSessionId("");
                      m.setMessages([]);
                    },
                  })
                }
              >
                삭제
              </Button>
            )}
          </div>
        </div>
        <div
          className="chat-scroll"
          aria-live="polite"
          aria-busy={m.busy || m.messageLoading}
          ref={viewport}
          onScroll={(event) => {
            const element = event.currentTarget;
            follow.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              100;
          }}
        >
          {m.messagePage > 0 && (
            <Button
              size="small"
              variant="secondary"
              loading={m.busy}
              onClick={() =>
                void m.run(async () => {
                  const older = await api<Page<Message>>(
                    `${m.base}/chat/sessions/${m.sessionId}/messages?size=100&page=${m.messagePage - 1}`,
                  );
                  m.setMessages((old) => [...older.items, ...old]);
                  m.setMessagePage(m.messagePage - 1);
                })
              }
            >
              이전 메시지 불러오기
            </Button>
          )}
          {m.messageLoading ? (
            <ContentSkeleton view="커뮤니티" label="대화를 불러오고 있어요" />
          ) : m.messages.length ? (
            m.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSource={onSource}
                streaming={message.id === m.streamingId}
              />
            ))
          ) : (
            <div className="chat-welcome">
              <PageIllustration
                variant="assistant"
                className="chat-welcome-art"
              />
              <h2 className="sr-only">모아AI에 질문하기</h2>
              <p className="chat-welcome-copy">
                {m.group?.name ?? "현재"} 모임에 대해 궁금한 점을
                <br />
                모아AI에 질문하세요.
              </p>
            </div>
          )}
          {m.busy &&
            !m.messages.find((message) => message.id === m.streamingId)
              ?.content && (
              <div className="thinking-status" role="status">
                <MoaAiIcon size={20} />
                <span>
                  {m.streamStage === "retrieving"
                    ? "모임에 대해 확인하고 있어요"
                    : m.streamStage === "saving"
                      ? "답변을 마무리하고 있어요"
                      : "답변을 작성하고 있어요"}
                </span>
                <span className="thinking-dots">•••</span>
              </div>
            )}
        </div>
        <div className="chat-composer-area">
          <div className={`chat-usage${exhausted ? " is-exhausted" : ""}`}>
            <span className="chat-usage-count" role="status" aria-live="polite">
              <MoaAiIcon size={16} />
              {usageError ? (
                "횟수를 확인하지 못했어요"
              ) : m.aiUsage ? (
                <>
                  오늘 <strong>{m.aiUsage.remaining}</strong>
                  <span>/ {m.aiUsage.limit}회 남음</span>
                </>
              ) : (
                "오늘의 질문 횟수 확인 중…"
              )}
            </span>
            {usageError ? (
              <Button
                variant="ghost"
                size="small"
                onClick={() => setUsageReload((value) => value + 1)}
              >
                다시 확인
              </Button>
            ) : (
              <span className="chat-usage-reset">
                {exhausted
                  ? "내일 다시 만나요"
                  : "매일 00:00 초기화 · 한국 시간"}
              </span>
            )}
          </div>
          {exhausted && (
            <p className="chat-usage-notice">
              오늘의 질문을 모두 사용했어요. 한국 시간 자정 이후 다시 질문해
              주세요.
            </p>
          )}
          {m.error && (
            <div className="chat-stream-error" role="alert">
              <Icon name="close" size={18} />
              <span>{m.error}</span>
              <Button
                variant="ghost"
                size="small"
                aria-label="AI 오류 안내 닫기"
                onClick={() => m.setError("")}
              >
                닫기
              </Button>
            </div>
          )}
          <QuestionComposer
            busy={m.busy}
            disabled={!m.aiUsage || usageError || exhausted}
            groupName={m.group?.name}
            onSend={m.sendQuestion}
            onStop={m.streamingId ? m.cancelAnswer : undefined}
          />
          <p className="chat-disclaimer">답변의 출처를 함께 확인해 주세요.</p>
        </div>
      </div>
    </section>
  );
}
