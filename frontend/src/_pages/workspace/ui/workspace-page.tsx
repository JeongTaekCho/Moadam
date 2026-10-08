"use client";
import { logout } from "@/features/auth";
import { EditorDialog } from "@/features/content-editor";
import { api, setApiScope } from "@/shared/api";
import {
  Button,
  BrandLogo,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Toast,
  Dialog,
} from "@/shared/ui";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useWorkspace } from "../model/use-workspace";
import { AuthScreen } from "./auth-screen";
import { ChatView } from "./chat-view";
import { CommunityView } from "./community-view";
import { DocumentsView } from "./documents-view";
import { EventsView } from "./events-view";
import { MyPageView } from "./my-page-view";
import { HomeView } from "./home-view";
import { MembersView } from "./members-view";
import { SettingsView } from "./settings-view";
import { useEffect, useState } from "react";
export function WorkspacePage({
  initialView = "홈",
}: {
  initialView?: import("@/shared/config/navigation").View;
}) {
  const m = useWorkspace(initialView);
  const [assistantOpen, setAssistantOpen] = useState(initialView === "챗봇");
  const assistantModel = {
    ...m,
    changeView: (view: import("@/shared/config/navigation").View) => {
      if (view === "챗봇") setAssistantOpen(true);
      else {
        setAssistantOpen(false);
        m.changeView(view);
      }
    },
    openDocument: (id: string) => {
      setAssistantOpen(false);
      return m.openDocument(id);
    },
    sendQuestion: (question: string) => {
      setAssistantOpen(true);
      return m.sendQuestion(question);
    },
  };
  useEffect(() => {
    if (assistantOpen && m.groupId) void m.loadAssistant();
  }, [assistantOpen, m.groupId]);
  useEffect(() => {
    if (m.view === "챗봇") {
      setAssistantOpen(true);
      m.changeView("홈");
    }
  }, [m.view]);
  if (m.boot)
    return (
      <main className="boot-screen">
        <div className="brand">
          <BrandLogo />
        </div>
        <p>모임의 공간을 준비하고 있어요</p>
        <div className="loading-inline" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>로그인 상태를 확인하고 있어요</span>
        </div>
      </main>
    );
  if (!m.signed) return <AuthScreen model={m} />;
  return (
    <>
      <WorkspaceShell
        profile={m.profile}
        groups={m.groups}
        group={m.group}
        groupId={m.groupId}
        view={m.view === "챗봇" ? "홈" : m.view}
        onGroup={m.changeGroup}
        onView={(view) =>
          view === "챗봇" ? setAssistantOpen(true) : m.changeView(view)
        }
        onAssistant={() => setAssistantOpen(true)}
        busy={m.busy}
        onCreate={() => m.setModal({ kind: "group" })}
        onJoin={() => m.setModal({ kind: "join" })}
        onLogout={() =>
          void m.run(async () => {
            await logout();
            m.setSigned(false);
            m.setProfile(null);
            setApiScope("");
            m.setGroups([]);
            m.setGroupId("");
            m.setMessages([]);
            m.setPosts([]);
            m.setEvents([]);
            m.setDocuments([]);
          })
        }
      >
        {m.error && (
          <ErrorState message={m.error} onRetry={() => void m.load()} />
        )}{" "}
        {!m.groupId && m.view !== "마이페이지" ? (
          <Card className="no-group">
            <span className="assistant-emblem">
              <Icon name="people" size={28} />
            </span>
            <EmptyState
              title="우리 모임의 공간을 만들어 볼까요?"
              description="새 모임을 만들거나 받은 초대 코드로 참여하세요."
            />
            <div className="row">
              <Button onClick={() => m.setModal({ kind: "group" })}>
                <Icon name="plus" size={17} />
                모임 만들기
              </Button>
              <Button
                variant="secondary"
                onClick={() => m.setModal({ kind: "join" })}
              >
                초대 참여
              </Button>
            </div>
          </Card>
        ) : !m.viewReady && !m.error ? (
          <div
            className="view-skeleton"
            role="status"
            aria-label="화면을 불러오고 있어요"
          >
            <span className="sr-only">화면을 불러오고 있어요</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-block" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div key={m.view} className="workspace-content" aria-busy={m.loading}>
            {m.loading && (
              <div
                className="workspace-refresh"
                role="status"
                aria-label="최신 정보를 불러오고 있어요"
              />
            )}
            {m.view === "마이페이지" && <MyPageView model={m} />}
            {m.view === "홈" && <HomeView model={assistantModel} />}{" "}
            {m.view === "커뮤니티" && <CommunityView model={m} />}{" "}
            {m.view === "일정" && <EventsView model={m} />}{" "}
            {m.view === "자료" && <DocumentsView model={assistantModel} />}{" "}
            {m.view === "멤버" && <MembersView model={m} />}{" "}
            {m.view === "설정" && <SettingsView model={m} />}{" "}
            {["커뮤니티", "일정", "자료", "멤버"].includes(m.view) &&
              !m.post &&
              !m.event &&
              !m.document &&
              m.total > (m.view === "일정" ? 100 : 20) && (
                <div className="pagination">
                  <Button
                    variant="secondary"
                    disabled={m.page === 0}
                    onClick={() => m.setPage(m.page - 1)}
                  >
                    이전
                  </Button>
                  <span>{m.page + 1} 페이지</span>
                  <Button
                    variant="secondary"
                    disabled={
                      (m.page + 1) * (m.view === "일정" ? 100 : 20) >= m.total
                    }
                    onClick={() => m.setPage(m.page + 1)}
                  >
                    다음
                  </Button>
                </div>
              )}
          </div>
        )}
      </WorkspaceShell>
      {assistantOpen && m.groupId && (
        <Dialog
          title="모아AI"
          className="assistant-dialog"
          onClose={() => setAssistantOpen(false)}
        >
          <ChatView model={assistantModel} />
        </Dialog>
      )}
      <EditorDialog
        modal={m.modal}
        busy={m.busy}
        error={m.error}
        admin={m.admin}
        onClose={() => m.setModal(null)}
        submit={m.submit}
      />
      {m.confirm && (
        <ConfirmDialog
          title={m.confirm.title}
          loading={m.busy}
          onClose={() => !m.busy && m.setConfirm(null)}
          onConfirm={() =>
            void m.run(async () => {
              await api(m.confirm!.path, "DELETE");
              m.confirm!.after?.();
              m.setConfirm(null);
              await m.load();
              m.notify("삭제했습니다");
            })
          }
        />
      )}
      <Toast message={m.toast} />
    </>
  );
}
