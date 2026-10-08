"use client";
import type { Message } from "@/entities/chat";
import { ChatMessage } from "@/entities/chat";
import { QuestionComposer } from "@/features/ask-question";
import { api, type Page } from "@/shared/api";

import { Button, Icon, MoaAiIcon, PageIllustration } from "@/shared/ui";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { ContentSkeleton } from "@/shared/ui/skeleton";
import type { WorkspaceModel } from "../model/use-workspace";
export function ChatView({ model: m }: { model: WorkspaceModel }) {
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
          <QuestionComposer
            busy={m.busy}
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
