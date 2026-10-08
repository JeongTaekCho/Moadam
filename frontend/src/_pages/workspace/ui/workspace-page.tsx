"use client";
import { logout } from "@/features/auth";
import dynamic from "next/dynamic";
import { ContentSkeleton, WorkspaceSkeleton } from "@/shared/ui/skeleton";
import { api, setApiScope } from "@/shared/api";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Toast,
  Dialog,
  MoaAiIcon,
} from "@/shared/ui";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useWorkspace } from "../model/use-workspace";
import { AuthScreen } from "./auth-screen";
const ChatView = dynamic(
  () => import("./chat-view").then((module) => module.ChatView),
  { loading: () => <ContentSkeleton view="챗봇" /> },
);
const CommunityView = dynamic(
  () => import("./community-view").then((module) => module.CommunityView),
  { loading: () => <ContentSkeleton view="커뮤니티" /> },
);
const DocumentsView = dynamic(
  () => import("./documents-view").then((module) => module.DocumentsView),
  { loading: () => <ContentSkeleton view="자료" /> },
);
const EventsView = dynamic(
  () => import("./events-view").then((module) => module.EventsView),
  { loading: () => <ContentSkeleton view="일정" /> },
);
const MyPageView = dynamic(
  () => import("./my-page-view").then((module) => module.MyPageView),
  { loading: () => <ContentSkeleton view="마이페이지" /> },
);
import { HomeView } from "./home-view";
const MembersView = dynamic(
  () => import("./members-view").then((module) => module.MembersView),
  { loading: () => <ContentSkeleton view="멤버" /> },
);
const SettingsView = dynamic(
  () => import("./settings-view").then((module) => module.SettingsView),
  { loading: () => <ContentSkeleton view="설정" /> },
);
import { useEffect, useState, lazy, Suspense } from "react";
import { usePathname } from "next/navigation";
import { viewFromPath } from "@/shared/config/navigation";
const EditorDialog = lazy(() =>
  import("@/features/content-editor/ui/editor-dialog").then((module) => ({
    default: module.EditorDialog,
  })),
);
export function WorkspacePage({
  initialView = "홈",
  hasSession = false,
}: {
  hasSession?: boolean;
  initialView?: import("@/shared/config/navigation").View;
}) {
  const pathname = usePathname();
  const m = useWorkspace(initialView, hasSession);
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
    if (assistantOpen && m.signed && m.groupId) void m.loadAssistant();
  }, [assistantOpen, m.signed, m.groupId, m.loadAssistant]);
  useEffect(() => {
    if (m.signed && viewFromPath(pathname) === "챗봇") setAssistantOpen(true);
  }, [pathname, m.signed]);
  if (m.boot) return <WorkspaceSkeleton />;
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
            setAssistantOpen(false);
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
          <ErrorState message={m.error} onRetry={() => void m.load(true)} />
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
          <ContentSkeleton view={m.view} />
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
          icon={<MoaAiIcon size={28} />}
          className="assistant-dialog"
          onClose={() => setAssistantOpen(false)}
        >
          <ChatView model={assistantModel} />
        </Dialog>
      )}
      {m.modal && (
        <Suspense
          fallback={
            <Dialog title="편집 화면 준비" onClose={() => m.setModal(null)}>
              <ContentSkeleton
                view="커뮤니티"
                label="편집 화면을 준비하고 있어요"
              />
            </Dialog>
          }
        >
          <EditorDialog
            modal={m.modal}
            busy={m.busy}
            error={m.error}
            admin={m.admin}
            onClose={() => m.setModal(null)}
            submit={m.submit}
          />
        </Suspense>
      )}
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
