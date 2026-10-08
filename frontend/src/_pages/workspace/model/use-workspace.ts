"use client";
import type { Message, Session } from "@/entities/chat";
import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Group, Invite, Member } from "@/entities/group";
import type { Comment, Post } from "@/entities/post";
import { saveEditor, type Modal } from "@/features/content-editor";
import type { Page } from "@/shared/api";

import { api, ApiError, getApiScope, setApiScope } from "@/shared/api";
import {
  navigateWorkspace,
  viewFromPath,
  type View,
} from "@/shared/config/navigation";
import { usePathname } from "next/navigation";
import { values } from "@/shared/lib/form";
import { koreaMonthStart } from "@/shared/lib/form";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
export function useWorkspace(initialView: View = "홈") {
  const pathname = usePathname();
  const loadVersion = useRef(0);
  const [loadedKey, setLoadedKey] = useState("");
  const busyRef = useRef(false);
  const detailOrigin = useRef<{ view: View; page: number } | null>(null);
  const [commentPage, setCommentPage] = useState(0),
    [commentTotal, setCommentTotal] = useState(0),
    [messagePage, setMessagePage] = useState(0);
  const [signed, setSigned] = useState(false),
    [boot, setBoot] = useState(true),
    [groups, setGroups] = useState<Group[]>([]),
    [groupId, setGroupId] = useState(""),
    [me, setMe] = useState(""),
    [view, setView] = useState<View>(initialView);
  const [posts, setPosts] = useState<Post[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [documents, setDocuments] = useState<Document[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Invite[]>([]);
  const [post, setPost] = useState<Post | null>(null),
    [comments, setComments] = useState<Comment[]>([]),
    [event, setEvent] = useState<Event | null>(null),
    [attendance, setAttendance] = useState<
      { user_id: string; status: string }[]
    >([]),
    [document, setDocument] = useState<Document | null>(null),
    [sessionId, setSessionId] = useState(""),
    [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      path: string;
      after?: () => void;
    } | null>(null),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [month, setMonth] = useState(koreaMonthStart),
    [authTab, setAuthTab] = useState("로그인"),
    [inviteToken, setInviteToken] = useState("");
  const group = groups.find((g) => g.id === groupId),
    admin = !!group && group.role !== "member",
    owner = group?.role === "owner";
  const base = `groups/${groupId}`;
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  };
  const fail = useCallback((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    setError(e instanceof Error ? e.message : "요청을 처리하지 못했습니다");
    if (e instanceof ApiError && e.status === 401) setSigned(false);
  }, []);
  const loadGroups = useCallback(async () => {
    const [g, u] = await Promise.all([
      api<Page<Group>>("groups?size=100"),
      api<{ id: string }>("me"),
    ]);
    setGroups(g.items);
    setMe(u.id);
    const requested =
      getApiScope() ||
      new URLSearchParams(window.location.search).get("group") ||
      "";
    const selected = g.items.some((x) => x.id === requested)
      ? requested
      : g.items[0]?.id || "";
    if (getApiScope() !== selected) {
      setPosts([]);
      setEvents([]);
      setDocuments([]);
      setMembers([]);
      setSessions([]);
      setInvites([]);
      setPost(null);
      setEvent(null);
      setDocument(null);
      setComments([]);
      setAttendance([]);
      setSessionId("");
      setMessages([]);
      setInviteToken("");
      setPage(0);
    }
    setApiScope(selected);
    setGroupId(selected);
    setSigned(true);
  }, []);
  useEffect(() => {
    setView(viewFromPath(window.location.pathname) || initialView);
    loadGroups()
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) fail(e);
      })
      .finally(() => setBoot(false));
  }, [loadGroups, fail]);
  const load = useCallback(async () => {
    if (!groupId) return;
    const requestId = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      if (view === "홈") {
        const [p, e, d] = await Promise.all([
          api<Page<Post>>(`${base}/posts?size=5`),
          api<Page<Event>>(
            `${base}/events?size=5&from=${encodeURIComponent(new Date().toISOString())}`,
          ),
          api<Page<Document>>(`${base}/documents?size=5`),
        ]);
        if (requestId !== loadVersion.current) return;
        setPosts(p.items);
        if (requestId !== loadVersion.current) return;
        setEvents(e.items.filter((x) => new Date(x.ends_at) > new Date()));
        if (requestId !== loadVersion.current) return;
        setDocuments(d.items);
      }
      if (view === "커뮤니티") {
        const p = await api<Page<Post>>(`${base}/posts?page=${page}`);
        if (requestId !== loadVersion.current) return;
        setPosts(p.items);
        setTotal(p.total);
      }
      if (view === "일정") {
        const e = await api<Page<Event>>(
          `${base}/events?page=${page}&size=100`,
        );
        if (requestId !== loadVersion.current) return;
        setEvents(e.items);
        setTotal(e.total);
      }
      if (view === "자료") {
        const d = await api<Page<Document>>(`${base}/documents?page=${page}`);
        if (requestId !== loadVersion.current) return;
        setDocuments(d.items);
        setTotal(d.total);
      }
      if (view === "챗봇") {
        const [s, d] = await Promise.all([
          api<Page<Session>>(`${base}/chat/sessions?page=${page}`),
          api<Page<Document>>(`${base}/documents?size=100`),
        ]);
        if (requestId !== loadVersion.current) return;
        setDocuments(d.items);
        setSessions(s.items);
        setTotal(s.total);
      }
      if (view === "멤버") {
        const m = await api<Page<Member>>(`${base}/members?page=${page}`);
        if (requestId !== loadVersion.current) return;
        setMembers(m.items);
        setTotal(m.total);
        if (admin) {
          const i = await api<Page<Invite>>(`${base}/invites?size=100`);
          if (requestId !== loadVersion.current) return;
          setInvites(i.items);
        }
      }
      if (requestId === loadVersion.current)
        setLoadedKey(`${groupId}:${view}:${page}`);
    } catch (e) {
      if (requestId === loadVersion.current) fail(e);
    } finally {
      if (requestId === loadVersion.current) setLoading(false);
    }
  }, [groupId, base, view, page, admin, fail]);
  useEffect(() => {
    void load();
    return () => {
      loadVersion.current++;
    };
  }, [load]);
  const changeGroup = (id: string) => {
    detailOrigin.current = null;
    navigateWorkspace("홈", id);
    setApiScope(id);
    setGroupId(id);
    setPosts([]);
    setEvents([]);
    setDocuments([]);
    setMembers([]);
    setSessions([]);
    setInvites([]);
    setPost(null);
    setEvent(null);
    setDocument(null);
    setSessionId("");
    setMessages([]);
    setView("홈");
    setPage(0);
    setModal(null);
    setError("");
    setInviteToken("");
  };
  const changeView = (next: View) => {
    detailOrigin.current = null;
    navigateWorkspace(next, groupId);
    setView(next);
    setPage(0);
    setPost(null);
    setEvent(null);
    setDocument(null);
    setError("");
  };
  useEffect(() => {
    const next = viewFromPath(pathname);
    if (!next || next === view) return;
    detailOrigin.current = null;
    setView(next);
    setPage(0);
    setPost(null);
    setEvent(null);
    setDocument(null);
    setError("");
  }, [pathname, view]);
  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const canEdit = (author: string) => admin || author === me;
  async function openPost(p: Post) {
    setLoading(true);
    setError("");
    try {
      const [detail, c] = await Promise.all([
        api<Post>(`${base}/posts/${p.id}`),
        api<Page<Comment>>(`${base}/posts/${p.id}/comments?size=100`),
      ]);
      setPost(detail);
      setComments(c.items);
      setCommentPage(0);
      setCommentTotal(c.total);
      detailOrigin.current = { view, page };
      navigateWorkspace("커뮤니티", groupId);
      setView("커뮤니티");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }
  async function openEvent(e: Event) {
    setLoading(true);
    setError("");
    try {
      setAttendance(await api(`${base}/events/${e.id}/attendance`));
      setEvent(e);
      detailOrigin.current = { view, page };
      navigateWorkspace("일정", groupId);
      setView("일정");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }
  async function openDocument(id: string) {
    setLoading(true);
    setError("");
    try {
      setDocument(await api<Document>(`${base}/documents/${id}`));
      detailOrigin.current = { view, page };
      navigateWorkspace("자료", groupId);
      setView("자료");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }
  function goBackFromDetail() {
    const origin = detailOrigin.current;
    detailOrigin.current = null;
    setPost(null);
    setEvent(null);
    setDocument(null);
    if (origin && origin.view !== view) {
      window.history.back();
    } else if (origin) {
      setPage(origin.page);
    }
  }
  async function openSession(id: string) {
    setLoading(true);
    setError("");
    try {
      const m = await api<Page<Message>>(
        `${base}/chat/sessions/${id}/messages?size=100`,
      );
      const lastPage = Math.max(0, Math.ceil(m.total / 100) - 1);
      const latest =
        lastPage > 0
          ? await api<Page<Message>>(
              `${base}/chat/sessions/${id}/messages?size=100&page=${lastPage}`,
            )
          : m;
      setSessionId(id);
      setMessagePage(lastPage);
      setMessages(latest.items);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    const b = values(e);
    const file = (
      e.currentTarget.elements.namedItem("file") as HTMLInputElement
    )?.files?.[0];
    const active = modal;
    if (!active) return;
    await run(async () => {
      const saved = await saveEditor({
        active,
        fields: b,
        file,
        base,
        postId: post?.id,
      });
      if (saved.group) {
        await loadGroups();
        changeGroup(saved.group.id);
        notify(
          active.kind === "join"
            ? "모임에 참여했습니다"
            : "모임을 만들었습니다",
        );
      }
      if (active.kind === "post") setPost(null);
      if (active.kind === "event") setEvent(null);
      if (active.kind === "comment" && post) await openPost(post);
      if (active.kind === "documentEdit" && active.item)
        await openDocument(active.item.id);
      if (active.kind === "memo" || active.kind === "pdf")
        notify("자료를 등록했습니다. 처리 상태를 확인해 주세요.");
      setModal(null);
      if (active.kind !== "group" && active.kind !== "join") await load();
      if (!["memo", "pdf", "group", "join"].includes(active.kind))
        notify("저장했습니다");
    });
  }

  useEffect(() => {
    const onBack = () => {
      const next = viewFromPath(window.location.pathname) || "홈";
      detailOrigin.current = null;
      const requested = new URLSearchParams(window.location.search).get(
        "group",
      );
      if (
        requested &&
        requested !== groupId &&
        groups.some((g) => g.id === requested)
      ) {
        setApiScope(requested);
        setGroupId(requested);
        setPosts([]);
        setEvents([]);
        setDocuments([]);
        setMembers([]);
        setSessions([]);
        setInvites([]);
        setMessages([]);
        setSessionId("");
      }
      setView(next);
      setPage(0);
      setPost(null);
      setEvent(null);
      setDocument(null);
      setModal(null);
      setError("");
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [groupId, groups]);
  async function sendQuestion(question: string): Promise<boolean> {
    if (busyRef.current || !question.trim()) return false;
    let succeeded = false;
    await run(async () => {
      let id = sessionId;
      if (!id) {
        const s = await api<Session>(`${base}/chat/sessions`, "POST", {
          title: question.trim().slice(0, 60),
        });
        id = s.id;
        setSessionId(id);
        setMessages([]);
        setMessagePage(0);
      }
      await api(`${base}/chat/sessions/${id}/messages`, "POST", {
        question: question.trim(),
      });
      await openSession(id);
      const sessions = await api<Page<Session>>(
        `${base}/chat/sessions?page=${page}`,
      );
      setSessions(sessions.items);
      setTotal(sessions.total);
      succeeded = true;
    });
    return succeeded;
  }
  return {
    loadAssistant: async () => {
      if (!groupId) return;
      try {
        const [s, d] = await Promise.all([
          api<Page<Session>>(`${base}/chat/sessions?page=0`),
          api<Page<Document>>(`${base}/documents?size=100`),
        ]);
        setSessions(s.items);
        setDocuments(d.items);
        setTotal(s.total);
      } catch (e) {
        fail(e);
      }
    },
    sendQuestion,
    busyRef,
    commentPage,
    setCommentPage,
    commentTotal,
    setCommentTotal,
    messagePage,
    setMessagePage,
    signed,
    setSigned,
    boot,
    setBoot,
    groups,
    setGroups,
    groupId,
    setGroupId,
    me,
    setMe,
    view,
    setView,
    posts,
    setPosts,
    events,
    setEvents,
    documents,
    setDocuments,
    sessions,
    setSessions,
    members,
    setMembers,
    invites,
    setInvites,
    post,
    setPost,
    comments,
    setComments,
    event,
    setEvent,
    attendance,
    setAttendance,
    document,
    setDocument,
    sessionId,
    setSessionId,
    messages,
    setMessages,
    loading,
    viewReady: loadedKey === `${groupId}:${view}:${page}`,
    setLoading,
    busy,
    setBusy,
    error,
    setError,
    toast,
    setToast,
    modal,
    setModal,
    confirm,
    setConfirm,
    page,
    setPage,
    total,
    setTotal,
    month,
    setMonth,
    authTab,
    setAuthTab,
    inviteToken,
    setInviteToken,
    group,
    admin,
    owner,
    base,
    notify,
    fail,
    loadGroups,
    load,
    changeGroup,
    changeView,
    run,
    canEdit,
    openPost,
    openEvent,
    openDocument,
    goBackFromDetail,
    openSession,
    submit,
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;
