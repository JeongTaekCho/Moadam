"use client";
import type { MyProfile } from "@/shared/api";
import type { Group } from "@/entities/group";
import { GroupSwitcher } from "@/entities/group";

import { viewPaths, type View } from "@/shared/config/navigation";
import Link from "next/link";
import { Avatar, Badge, BrandLogo, Dialog, Icon } from "@/shared/ui";
import type { IconName } from "@/shared/ui/icon";
import { useState, type ReactNode } from "react";
const primary: { view: View; label: string; icon: IconName }[] = [
  { view: "홈", label: "모임 홈", icon: "home" },
  { view: "챗봇", label: "모아AI", icon: "spark" },
  { view: "자료", label: "자료 보관함", icon: "file" },
  { view: "커뮤니티", label: "커뮤니티", icon: "posts" },
  { view: "일정", label: "일정", icon: "calendar" },
];
const secondary: typeof primary = [
  { view: "마이페이지", label: "마이페이지", icon: "people" },
  { view: "멤버", label: "멤버 · 초대", icon: "people" },
  { view: "설정", label: "모임 설정", icon: "settings" },
];
const titles: Record<View, { title: string; description: string }> = {
  마이페이지: {
    title: "나의 모아담",
    description: "프로필을 꾸미고, 함께 남긴 기록을 살펴보세요.",
  },
  홈: {
    title: "모임의 오늘, 함께 살펴봐요",
    description: "이야기와 일정, 쌓아온 지식을 한곳에서.",
  },
  챗봇: {
    title: "모아AI",
    description: "모임 자료를 바탕으로 답하고, 근거를 함께 보여드려요.",
  },
  자료: {
    title: "자료 보관함",
    description: "함께 쌓은 자료가 모임의 지식이 됩니다.",
  },
  커뮤니티: {
    title: "커뮤니티",
    description: "작은 소식부터 좋은 질문까지, 함께 나누세요.",
  },
  일정: {
    title: "함께할 일정",
    description: "다음 만남을 계획하고 참석 여부를 알려주세요.",
  },
  멤버: {
    title: "함께하는 사람들",
    description: "모임 멤버와 초대를 관리하세요.",
  },
  설정: {
    title: "모임 설정",
    description: "모임의 기본 정보와 공유 범위를 관리하세요.",
  },
};
type Props = {
  profile: MyProfile | null;
  groups: Group[];
  group?: Group;
  groupId: string;
  view: View;
  onGroup: (id: string) => void;
  onView: (v: View) => void;
  onAssistant: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onLogout: () => void;
  children: ReactNode;
  busy: boolean;
};
export function WorkspaceShell(p: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (v: View) => {
    if (v === "챗봇") p.onAssistant();
    else p.onView(v);
    setMobileOpen(false);
  };
  const nav = (items: typeof primary) => (
    <nav className="workspace-nav" aria-label="모임 메뉴">
      {items.map((x) =>
        x.view === "챗봇" ? (
          <button
            key={x.view}
            onClick={() => navigate(x.view)}
            disabled={!p.groupId}
          >
            <Icon name={x.icon} />
            <span>{x.label}</span>
            <span className="nav-ai">AI</span>
          </button>
        ) : (
          <Link
            key={x.view}
            href={
              viewPaths[x.view] +
              (p.groupId ? "?group=" + encodeURIComponent(p.groupId) : "")
            }
            scroll={false}
            aria-current={p.view === x.view ? "page" : undefined}
            aria-disabled={!p.groupId && x.view !== "마이페이지"}
            className={p.view === x.view ? "active" : ""}
            onNavigate={(event) => {
              event.preventDefault();
              if (p.groupId || x.view === "마이페이지") navigate(x.view);
            }}
          >
            <Icon name={x.icon} />
            <span>{x.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
  const sidebar = (
    <>
      <div className="brand">
        <BrandLogo subtitle />
      </div>
      <div className="workspace-switch">
        {p.groups.length > 0 ? (
          <GroupSwitcher
            groups={p.groups}
            current={p.groupId}
            onChange={(id) => {
              p.onGroup(id);
              setMobileOpen(false);
            }}
          />
        ) : (
          <p className="muted">내 모임을 만들어 보세요</p>
        )}
        <div className="workspace-actions">
          <button onClick={p.onCreate}>
            <Icon name="plus" size={15} />
            모임 만들기
          </button>
          <button onClick={p.onJoin}>초대 참여</button>
        </div>
      </div>
      <p className="nav-label">워크스페이스</p>
      {nav(primary)}
      <p className="nav-label management-label">모임 관리</p>
      {nav(secondary)}
      <div className="sidebar-bottom">
        <div className="privacy-note">
          <Icon name="lock" size={16} />
          <span>
            현재 모임 멤버만
            <br />
            자료를 볼 수 있어요.
          </span>
        </div>
        <button
          className="account-button"
          disabled={p.busy}
          onClick={() => navigate("마이페이지")}
        >
          <Avatar
            name={p.profile?.display_name || "내 계정"}
            src={p.profile?.avatar_url}
          />
          <span>
            {p.profile?.display_name || "내 계정"}
            <small>프로필과 내 활동 보기</small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
        <button
          className="account-logout"
          disabled={p.busy}
          onClick={p.onLogout}
        >
          <Icon name="logout" size={15} />
          로그아웃
        </button>
      </div>
    </>
  );
  return (
    <div className="shell">
      <a href="#workspace-main" className="skip-link">
        본문으로 이동
      </a>
      <aside className="sidebar desktop-sidebar">{sidebar}</aside>
      <div className="workspace-body">
        <div className="topbar">
          <div className="row">
            <button
              className="icon-button mobile-menu"
              aria-label="모임 메뉴 열기"
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb">
              {p.group?.name || "내 모임"}
              <span>/</span>
              <strong>
                {
                  primary.concat(secondary).find((x) => x.view === p.view)
                    ?.label
                }
              </strong>
            </span>
          </div>
          <span className="topbar-private">
            <Icon name="lock" size={14} />
            모임 전용 공간
          </span>
        </div>
        <main
          className={"main " + (p.view === "챗봇" ? "main-chat" : "")}
          id="workspace-main"
          tabIndex={-1}
        >
          <header className="page-header">
            <div>
              <p className="eyebrow">
                {p.view === "홈"
                  ? "OUR WORKSPACE"
                  : p.view === "챗봇"
                    ? "KNOWLEDGE ASSISTANT"
                    : p.view === "자료"
                      ? "KNOWLEDGE LIBRARY"
                      : "TOGETHER IN MOADAM"}
              </p>
              <h1>{titles[p.view].title}</h1>
              <p className="muted">{titles[p.view].description}</p>
            </div>
            {p.view !== "마이페이지" && p.group?.role === "owner" ? (
              <span
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-600"
                role="img"
                aria-label="모임 소유자"
                title="모임 소유자"
              >
                <Icon name="crown" size={22} />
              </span>
            ) : (
              p.view !== "마이페이지" &&
              p.group && (
                <Badge tone="brand">
                  <span className="profile-avatar compact">
                    <Icon name="smile" size={16} />
                  </span>
                  <span>
                    {
                      { owner: "소유자", admin: "관리자", member: "멤버" }[
                        p.group.role
                      ]
                    }
                  </span>
                </Badge>
              )
            )}
          </header>
          {p.children}
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
        {[primary[0], primary[1], primary[2], primary[4]].map((x) => (
          <button
            key={x.view}
            disabled={!p.groupId}
            aria-current={p.view === x.view ? "page" : undefined}
            className={p.view === x.view ? "active" : ""}
            onClick={() => navigate(x.view)}
          >
            <Icon name={x.icon} />
            <span>
              {x.view === "챗봇"
                ? "모아AI"
                : x.view === "자료"
                  ? "자료"
                  : x.view}
            </span>
          </button>
        ))}
        <button onClick={() => setMobileOpen(true)}>
          <Icon name="menu" />
          <span>전체 메뉴</span>
        </button>
      </nav>
      {p.groupId && (
        <button
          className="assistant-fab"
          onClick={p.onAssistant}
          aria-label="모아AI 열기"
        >
          <span className="assistant-fab__mascot" aria-hidden="true">
            <Icon name="smile" size={23} />
            <i>✦</i>
          </span>
          <span className="assistant-fab__copy">
            <strong>모아AI</strong>
            <small>궁금한 걸 물어봐요</small>
          </span>
          <span className="assistant-fab__sparkle" aria-hidden="true">
            ✧
          </span>
        </button>
      )}
      {mobileOpen && (
        <Dialog title="모임 메뉴" onClose={() => setMobileOpen(false)}>
          <div className="mobile-sidebar">{sidebar}</div>
        </Dialog>
      )}
    </div>
  );
}
