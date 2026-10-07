"use client";
import type { Message } from "@/entities/chat";
import { ChatMessage } from "@/entities/chat";
import { QuestionComposer } from "@/features/ask-question";
import { api, type Page } from "@/shared/api";

import { Button, Icon } from "@/shared/ui";
import { useEffect, useRef } from "react";
import type { WorkspaceModel } from "../model/use-workspace";
export function ChatView({ model: m }: { model: WorkspaceModel }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [m.messages.length, m.busy]);
  const ready = m.documents.filter((d) => d.status === "ready").length;
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
            onClick={() => {
              m.setSessionId("");
              m.setMessages([]);
              m.setMessagePage(0);
            }}
          >
            <Icon name="plus" size={18} />
          </Button>
        </div>
        <p className="conversation-caption">나에게만 보이는 개인 대화</p>
        <div className="conversation-list">
          {m.sessions.length ? (
            m.sessions.map((s) => (
              <button
                className={m.sessionId === s.id ? "active" : ""}
                key={s.id}
                disabled={m.busy}
                onClick={() => void m.openSession(s.id)}
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
          <span>
            모임 자료 보관함<small>현재 목록에서 {ready}개 사용 가능</small>
          </span>
          <Icon name="arrow" size={15} />
        </button>
      </aside>
      <div className="chat-panel">
        <div className="chat-panel-header">
          <span className="row">
            <span className="assistant-dot" />
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
        <div className="chat-scroll" aria-live="polite" aria-busy={m.busy}>
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
          {m.messages.length ? (
            m.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSource={(id) => void m.openDocument(id)}
              />
            ))
          ) : (
            <div className="chat-welcome">
              <span className="assistant-emblem">
                <Icon name="spark" size={30} />
              </span>
              <p className="eyebrow">YOUR KNOWLEDGE, CONNECTED</p>
              <h2>
                함께 쌓은 자료에서
                <br />
                답을 찾아볼까요?
              </h2>
              <p>
                궁금한 점을 편하게 질문하세요.
                <br />
                모임 자료를 읽고, 출처와 함께 정리해드려요.
              </p>
              <div className="suggestion-grid">
                {[
                  {
                    icon: "file" as const,
                    title: "핵심만 빠르게",
                    q: "등록된 자료의 핵심 내용을 요약해줘",
                  },
                  {
                    icon: "posts" as const,
                    title: "쉽게 이해하기",
                    q: "자료의 주요 내용을 처음 보는 사람도 이해하도록 설명해줘",
                  },
                  {
                    icon: "calendar" as const,
                    title: "실행할 일 찾기",
                    q: "자료에서 준비하거나 해야 할 일을 정리해줘",
                  },
                ].map((x) => (
                  <button
                    key={x.title}
                    disabled={m.busy}
                    onClick={() => void m.sendQuestion(x.q)}
                  >
                    <Icon name={x.icon} size={19} />
                    <strong>{x.title}</strong>
                    <span>{x.q}</span>
                    <Icon name="arrow" size={15} />
                  </button>
                ))}
              </div>
              {ready === 0 && (
                <p className="chat-document-hint">
                  사용 가능한 자료가 없다면 보관함에서 처리 상태를 확인해
                  주세요.
                </p>
              )}
            </div>
          )}
          {m.busy && (
            <div className="thinking-status" role="status">
              <Icon name="spark" size={18} />
              <span>모임 자료에서 근거를 찾고 있어요</span>
              <span className="thinking-dots">•••</span>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="chat-composer-area">
          <QuestionComposer busy={m.busy} onSend={m.sendQuestion} />
          <p className="chat-disclaimer">
            답변이 정확한지 인용된 자료에서 확인해 주세요. 근거가 부족한 내용은
            안내해드려요.
          </p>
        </div>
      </div>
    </section>
  );
}
