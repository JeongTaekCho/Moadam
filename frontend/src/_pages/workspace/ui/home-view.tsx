"use client";
import { DocumentRow } from "@/entities/document";
import { EventCard } from "@/entities/event";
import { PostCard } from "@/entities/post";
import { Badge, Button, Card, EmptyState, Icon } from "@/shared/ui";
import type { WorkspaceModel } from "../model/use-workspace";
export function HomeView({ model: m }: { model: WorkspaceModel }) {
  const notices = m.posts.filter((p) => p.kind === "notice");
  const stories = m.posts.filter((p) => p.kind !== "notice");
  return (
    <div className="dashboard">
      <section className="knowledge-hero">
        <div className="hero-topline">
          <span className="hero-tag">
            <Icon name="spark" size={16} />
            우리 모임의 지식, 바로 찾아보세요
          </span>
          <span className="hero-private">
            <Icon name="lock" size={14} />
            모임 자료 기반
          </span>
        </div>
        <h2>
          궁금한 순간,
          <br />
          함께 쌓은 지식이 답이 돼요.
        </h2>
        <p>PDF와 메모에서 필요한 내용을 찾고, 출처까지 확인하세요.</p>
        <button className="hero-question" onClick={() => m.changeView("챗봇")}>
          <Icon name="search" />
          <span>우리 모임 자료에 무엇이 궁금하세요?</span>
          <span className="hero-question-arrow">
            <Icon name="arrow" size={19} />
          </span>
        </button>
        <div className="hero-prompts">
          <span>이렇게 물어보세요</span>
          {["자료의 핵심 내용을 요약해줘", "다음 모임 준비사항을 알려줘"].map(
            (q) => (
              <button
                key={q}
                disabled={m.busy}
                onClick={() => void m.sendQuestion(q)}
              >
                {q}
                <Icon name="arrow" size={13} />
              </button>
            ),
          )}
        </div>
      </section>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="dashboard-section">
            <div className="section-heading">
              <h2>
                <Icon name="posts" size={19} />
                모임의 이야기
              </h2>
              <Button
                variant="ghost"
                size="small"
                onClick={() => m.changeView("커뮤니티")}
              >
                전체 보기
                <Icon name="arrow" size={14} />
              </Button>
            </div>
            {notices.length > 0 && (
              <div className="notice-banner">
                <Badge tone="brand">공지</Badge>
                <button
                  className="post-title"
                  onClick={() => void m.openPost(notices[0])}
                >
                  {notices[0].title}
                </button>
                <Icon name="arrow" size={17} />
              </div>
            )}
            <div className="surface-list">
              {stories.length ? (
                stories
                  .slice(0, 3)
                  .map((p) => (
                    <PostCard
                      key={p.id}
                      post={p}
                      onOpen={() => void m.openPost(p)}
                    />
                  ))
              ) : (
                <div className="onboarding-empty">
                  <Icon name="posts" size={28} />
                  <h3>작은 이야기로 시작해 보세요</h3>
                  <p>오늘의 소식이나 함께 나누고 싶은 질문을 남겨보세요.</p>
                  <Button
                    variant="secondary"
                    onClick={() => m.setModal({ kind: "post" })}
                  >
                    <Icon name="plus" size={16} />첫 글 작성
                  </Button>
                </div>
              )}
            </div>
          </section>
          <section className="dashboard-section">
            <div className="section-heading">
              <h2>
                <Icon name="file" size={19} />
                최근 쌓은 지식
              </h2>
              <Button
                variant="ghost"
                size="small"
                onClick={() => m.changeView("자료")}
              >
                보관함 열기
                <Icon name="arrow" size={14} />
              </Button>
            </div>
            <div className="surface-list">
              {m.documents.length ? (
                m.documents
                  .slice(0, 3)
                  .map((d) => (
                    <DocumentRow
                      key={d.id}
                      document={d}
                      onOpen={() => void m.openDocument(d.id)}
                    />
                  ))
              ) : (
                <EmptyState
                  title="우리 모임의 첫 자료를 기다려요"
                  description="PDF나 메모를 등록하면 모아AI가 함께 찾아드려요."
                />
              )}
            </div>
            {m.admin && (
              <button
                className="inline-add"
                onClick={() => m.setModal({ kind: "pdf" })}
              >
                <Icon name="plus" size={16} />새 자료 추가하기
              </button>
            )}
          </section>
        </div>
        <aside className="dashboard-secondary">
          <section className="dashboard-section">
            <div className="section-heading">
              <h2>
                <Icon name="calendar" size={19} />
                다가오는 일정
              </h2>
              <Button
                size="small"
                variant="ghost"
                onClick={() => m.changeView("일정")}
              >
                전체 보기
              </Button>
            </div>
            <div className="surface-list schedule-list">
              {m.events.length ? (
                m.events
                  .slice(0, 3)
                  .map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      onOpen={() => void m.openEvent(e)}
                    />
                  ))
              ) : (
                <EmptyState
                  title="다음 만남을 계획해요"
                  description="다가오는 일정이 아직 없어요."
                />
              )}
              <button
                className="inline-add"
                onClick={() => m.setModal({ kind: "event" })}
              >
                <Icon name="plus" size={16} />
                일정 만들기
              </button>
            </div>
          </section>
          <Card className="getting-started">
            <span className="eyebrow">BETTER TOGETHER</span>
            <h3>우리 모임, 더 잘 활용하기</h3>
            <button onClick={() => m.changeView("자료")}>
              <span className="step-number">1</span>
              <span>
                함께 볼 자료를 모아요<small>PDF와 메모를 한곳에 보관</small>
              </span>
              <Icon name="arrow" size={15} />
            </button>
            <button onClick={() => m.changeView("챗봇")}>
              <span className="step-number">2</span>
              <span>
                궁금한 내용을 물어봐요<small>자료의 근거와 함께 답변</small>
              </span>
              <Icon name="arrow" size={15} />
            </button>
            <button onClick={() => m.changeView("멤버")}>
              <span className="step-number">3</span>
              <span>
                함께할 사람들을 초대해요<small>멤버와 안전하게 지식 공유</small>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          </Card>
          <div className="workspace-note">
            <Icon name="lock" size={16} />
            <p>
              이 공간의 이야기와 자료는
              <br />
              <strong>{m.group?.name}</strong> 멤버에게만 보여요.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
