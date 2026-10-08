"use client";
import type { Message, Session } from "@/entities/chat";
import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Group, Invite, Member } from "@/entities/group";
import type { Comment, Post } from "@/entities/post";
import { saveEditor, type Modal } from "@/features/content-editor";
import type { Page, MyProfile, MyActivity } from "@/shared/api";

import {
  api,
  ApiError,
  getApiScope,
  setApiScope,
  streamQuestion,
} from "@/shared/api";
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
  const streamAbort = useRef<AbortController | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamStage, setStreamStage] = useState("retrieving");
  useEffect(() => () => streamAbort.current?.abort(), []);
  const [loadedKey, setLoadedKey] = useState("");
  const busyRef = useRef(false);
  const activityVersion = useRef(0);
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
  const [profile, setProfile] = useState<MyProfile | null>(null);
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
      (async () => {
        const first = await api<Page<Group>>("groups?size=100");
        const items = [...first.items];
        for (let page = 1; items.length < first.total; page++) {
          const next = await api<Page<Group>>(`groups?size=100&page=${page}`);
          if (!next.items.length) break;
          items.push(...next.items);
        }
        return { ...first, items };
      })(),
      api<MyProfile>("me"),
    ]);
    setGroups(g.items);
    setMe(u.id);
    setProfile(u);
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
    const authError = new URLSearchParams(window.location.search).get(
      "auth_error",
    );
    const authMessages: Record<string, string> = {
      google_cancelled:
        "Google 로그인을 취소했거나 동의하지 않았습니다. 다시 시도해 주세요.",
      google_expired:
        "Google 로그인 요청이 만료되었습니다. 같은 브라우저에서 다시 시작해 주세요.",
      google_failed:
        "Google 로그인을 완료하지 못했습니다. 다시 시도하거나 이메일로 로그인해 주세요.",
    };
    if (authError && authMessages[authError]) {
      setError(authMessages[authError]);
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    loadGroups()
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) fail(e);
      })
      .finally(() => setBoot(false));
  }, [loadGroups, fail]);
  const load = useCallback(async () => {
    if (!signed || (!groupId && view !== "마이페이지")) return;
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
  }, [groupId, base, view, page, admin, signed, fail]);
  useEffect(() => {
    void load();
    return () => {
      loadVersion.current++;
    };
  }, [load]);
  const changeGroup = (id: string) => {
    streamAbort.current?.abort();
    activityVersion.current++;
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
    activityVersion.current++;
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
  async function openActivity(item: MyActivity, kind: "posts" | "documents") {
    if (!groups.some((group) => group.id === item.group_id)) {
      setError("참여 중인 모임의 기록만 열 수 있습니다");
      return;
    }
    changeGroup(item.group_id);
    const version = ++activityVersion.current;
    const next = kind === "posts" ? "커뮤니티" : "자료";
    navigateWorkspace(next, item.group_id);
    setView(next);
    try {
      if (kind === "posts") {
        const [post, comments] = await Promise.all([
          api<Post>(`groups/${item.group_id}/posts/${item.id}`),
          api<Page<Comment>>(
            `groups/${item.group_id}/posts/${item.id}/comments`,
          ),
        ]);
        if (
          version !== activityVersion.current ||
          getApiScope() !== item.group_id
        )
          return;
        setPost(post);
        setComments(comments.items);
        setCommentPage(0);
        setCommentTotal(comments.total);
      } else {
        const document = await api<Document>(
          `groups/${item.group_id}/documents/${item.id}`,
        );
        if (
          version !== activityVersion.current ||
          getApiScope() !== item.group_id
        )
          return;
        setDocument(document);
      }
    } catch (error) {
      if (version === activityVersion.current) fail(error);
    }
  }
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
      streamAbort.current?.abort();
      activityVersion.current++;
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
    const controller = new AbortController();
    streamAbort.current = controller;
    const scope = groupId;
    const userId = crypto.randomUUID(),
      answerId = crypto.randomUUID();
    let frame = 0;
    let chars: string[] = [],
      shown = 0,
      text = "",
      previous = 0;
    let finalMessages: { user: Message; assistant: Message } | null = null;
    const current = () => !controller.signal.aborted && getApiScope() === scope;
    function publish() {
      if (current())
        setMessages((old) =>
          old.map((message) =>
            message.id === answerId ? { ...message, content: text } : message,
          ),
        );
    }
    function finish() {
      if (!current() || !finalMessages) return;
      const saved = finalMessages;
      setMessages((old) =>
        old.map((message) =>
          message.id === userId
            ? saved.user
            : message.id === answerId
              ? saved.assistant
              : message,
        ),
      );
      setStreamingId(null);
      succeeded = true;
    }
    let resolveAnimation: (() => void) | undefined;
    function animate(now: number) {
      frame = 0;
      if (!current()) {
        resolveAnimation?.();
        return;
      }
      // Fast character reveal, at most one React update per display frame.
      // Catch up large bursts rather than adding seconds of artificial latency.
      const count = Math.max(
        1,
        Math.floor((now - (previous || now)) / 4),
        Math.ceil((chars.length - shown) / 40),
      );
      previous = now;
      const next = Math.min(chars.length, shown + count);
      text += chars.slice(shown, next).join("");
      shown = next;
      publish();
      if (shown < chars.length) frame = requestAnimationFrame(animate);
      else {
        previous = 0;
        resolveAnimation?.();
      }
    }
    await run(async () => {
      try {
        let id = sessionId;
        if (!id) {
          const session = await api<Session>(`${base}/chat/sessions`, "POST", {
            title: question.trim().slice(0, 60),
          });
          if (!current()) throw new DOMException("Cancelled", "AbortError");
          id = session.id;
          setSessionId(id);
          setMessages([]);
          setMessagePage(0);
          setSessions((old) => [session, ...old]);
        }
        const draft = {
          group_id: scope,
          session_id: id,
          citations: [],
          grounded: false,
          created_at: new Date().toISOString(),
        };
        setMessages((old) => [
          ...old,
          { ...draft, id: userId, role: "user", content: question.trim() },
          { ...draft, id: answerId, role: "assistant", content: "" },
        ]);
        setStreamingId(answerId);
        setStreamStage("retrieving");
        await streamQuestion(
          `${base}/chat/sessions/${id}/messages/stream`,
          question.trim(),
          (event) => {
            if (event.type === "status") setStreamStage(event.stage);
            if (event.type === "delta") {
              chars.push(...Array.from(event.text));
              if (!frame) frame = requestAnimationFrame(animate);
            }
            if (event.type === "done") {
              finalMessages = { user: event.user, assistant: event.assistant };
              // Replace provisional text with the authoritative validated answer.
              if (chars.join("") !== event.assistant.content) {
                cancelAnimationFrame(frame);
                frame = 0;
                chars = Array.from(event.assistant.content);
                shown = 0;
                text = "";
                frame = requestAnimationFrame(animate);
              }
            }
          },
          controller.signal,
        );
        if (globalThis.document.visibilityState === "hidden")
          shown = chars.length;
        if (shown < chars.length)
          await new Promise<void>((resolve) => {
            resolveAnimation = resolve;
            controller.signal.addEventListener("abort", () => resolve(), {
              once: true,
            });
          });
        finish();
      } finally {
        cancelAnimationFrame(frame);
        if (!succeeded && getApiScope() === scope)
          setMessages((old) =>
            old.filter(
              (message) => message.id !== userId && message.id !== answerId,
            ),
          );
        if (streamAbort.current === controller) {
          streamAbort.current = null;
          setStreamingId(null);
        }
      }
    });
    return succeeded;
  }
  return {
    streamingId,
    streamStage,
    cancelAnswer: () => streamAbort.current?.abort(),
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
    profile,
    setProfile,
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
    openActivity,
    openPost,
    openEvent,
    openDocument,
    goBackFromDetail,
    openSession,
    submit,
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;
