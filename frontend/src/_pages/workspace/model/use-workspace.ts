"use client";
import type { Message, Session } from "@/entities/chat";
import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import {
  calendarLayout,
  addDateDays,
  eventDateRange,
} from "@/entities/event/schedule";
import type { Group, Invite, Member } from "@/entities/group";
import type { Post } from "@/entities/post";
import {
  saveEditor,
  UploadInterruptedError,
} from "@/features/content-editor/api/save-editor";
import type { Modal } from "@/features/content-editor/model/types";
import type { Page, MyProfile, MyActivity, AiUsage } from "@/shared/api";

import {
  api,
  ApiError,
  getApiScope,
  setApiScope,
  invalidateApiCache,
  streamQuestion,
} from "@/shared/api";
import {
  subscribeWorkspacePath,
  detailFromPath,
  navigateWorkspace,
  viewFromPath,
  type View,
} from "@/shared/config/navigation";
import { usePathname } from "next/navigation";
import { values } from "@/shared/lib/form";
import { koreaDateKey, koreaMonthStart } from "@/shared/lib/form";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
export function useWorkspace(initialView: View = "홈", hasSession = false) {
  const routerPathname = usePathname();
  const pathname = useSyncExternalStore(
    subscribeWorkspacePath,
    () => window.location.pathname,
    () => routerPathname,
  );
  const routeDetail = detailFromPath(pathname);
  const detailId = routeDetail?.id;
  const detailResource = routeDetail?.resource;
  const loadVersion = useRef(0);
  const bootTask = useRef<Promise<void> | null>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const sessionVersion = useRef(0);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamStage, setStreamStage] = useState("retrieving");
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [groupLimitOpen, setGroupLimitOpen] = useState(false);
  useEffect(() => () => streamAbort.current?.abort(), []);
  const [loadedKey, setLoadedKey] = useState("");
  const busyRef = useRef(false);
  const activityVersion = useRef(0);
  const detailVersion = useRef(0);
  const assistantVersion = useRef(0);
  const detailOrigin = useRef<{ view: View; page: number } | null>(null);
  const [messagePage, setMessagePage] = useState(0);
  const [signed, setSigned] = useState(false),
    [boot, setBoot] = useState(hasSession),
    [groups, setGroups] = useState<Group[]>([]),
    [groupId, setGroupId] = useState(""),
    [me, setMe] = useState(""),
    [view, setView] = useState<View>(() => {
      const routeView = viewFromPath(pathname) || initialView;
      return routeView === "챗봇" ? "홈" : routeView;
    });
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [documents, setDocuments] = useState<Document[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Invite[]>([]);
  const [post, setPost] = useState<Post | null>(null),
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
  const calendarMonthKey = koreaDateKey(month).slice(0, 7);
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  };
  const fail = useCallback((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof ApiError && e.code === "GROUP_LIMIT_REACHED") {
      setModal(null);
      setError("");
      setGroupLimitOpen(true);
      return;
    }
    setError(e instanceof Error ? e.message : "요청을 처리하지 못했습니다");
    if (e instanceof ApiError && e.status === 401) setSigned(false);
  }, []);
  const loadGroups = useCallback(async () => {
    // Validate the session/profile first; an expired session must not fan out.
    const u = await api<MyProfile>("me");
    const first = await api<Page<Group>>("groups?size=100");
    const items = [...first.items];
    for (let page = 1; items.length < first.total; page++) {
      const next = await api<Page<Group>>(`groups?size=100&page=${page}`);
      if (!next.items.length) break;
      items.push(...next.items);
    }
    const g = { ...first, items };
    setGroups(g.items);
    setAiUsage(null);
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
      setLoadedKey("");
      setPosts([]);
      setEvents([]);
      setDocuments([]);
      setMembers([]);
      setSessions([]);
      setInvites([]);
      setPost(null);
      setEvent(null);
      setDocument(null);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Consume an external OAuth callback error once and remove it from the URL.
      setError(authMessages[authError]);
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    if (!hasSession) return;
    // Share bootstrap work across Strict Mode effect setup instead of duplicating requests.
    bootTask.current ??= loadGroups();
    bootTask.current
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) fail(e);
      })
      .finally(() => setBoot(false));
  }, [loadGroups, fail, hasSession]);
  const load = useCallback(
    async (fresh = false) => {
      if (!signed || !groupId || view === "마이페이지" || view === "설정")
        return;
      if (fresh) invalidateApiCache();
      const requestId = ++loadVersion.current;
      setLoading(true);
      setError("");
      try {
        const activeDetail = detailFromPath(window.location.pathname);
        const requestedDetailId = activeDetail?.id;
        const requestedResource = activeDetail?.resource;
        if (requestedDetailId && requestedResource) {
          if (requestedResource === "posts") {
            const detail = await api<Post>(
              `${base}/posts/${requestedDetailId}`,
            );
            if (requestId !== loadVersion.current) return;
            setPost(detail);
            setEvent(null);
          } else {
            const [detail, attendance] = await Promise.all([
              api<Event>(`${base}/events/${requestedDetailId}`),
              api<{ user_id: string; status: string }[]>(
                `${base}/events/${requestedDetailId}/attendance`,
              ),
            ]);
            if (requestId !== loadVersion.current) return;
            setEvent(detail);
            setAttendance(attendance);
            setPost(null);
          }
          setLoadedKey(`${groupId}:${view}:${page}:${requestedDetailId}`);
          return;
        }
        if (view === "홈") {
          const [p, e, d] = await Promise.all([
            api<Page<Post>>(`${base}/posts?size=5`),
            api<Page<Event>>(
              `${base}/events?size=5&from=${encodeURIComponent(new Date(Math.floor(Date.now() / 30000) * 30000).toISOString())}`,
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
          const gridStart = calendarLayout([], calendarMonthKey).start;
          const gridEnd = addDateDays(gridStart, 41);
          const from = encodeURIComponent(
            new Date(`${gridStart}T00:00:00+09:00`).toISOString(),
          );
          const collected: Event[] = [];
          for (let eventPage = 0; ; eventPage++) {
            const result = await api<Page<Event>>(
              `${base}/events?page=${eventPage}&size=100&from=${from}`,
            );
            if (requestId !== loadVersion.current) return;
            collected.push(
              ...result.items.filter((event) => {
                const range = eventDateRange(event);
                return range.start <= gridEnd && range.end >= gridStart;
              }),
            );
            if (
              !result.items.length ||
              (eventPage + 1) * result.size >= result.total ||
              koreaDateKey(new Date(result.items.at(-1)!.starts_at)) > gridEnd
            )
              break;
          }
          setEvents(collected);
          setTotal(collected.length);
        }
        if (view === "자료") {
          const d = await api<Page<Document>>(`${base}/documents?page=${page}`);
          if (requestId !== loadVersion.current) return;
          setDocuments(d.items);
          setTotal(d.total);
        }
        if (view === "멤버") {
          const [m, i] = await Promise.all([
            api<Page<Member>>(`${base}/members?page=${page}`),
            admin
              ? api<Page<Invite>>(`${base}/invites?size=100`)
              : Promise.resolve(null),
          ]);
          if (requestId !== loadVersion.current) return;
          setMembers(m.items);
          setTotal(m.total);
          setInvites(i?.items || []);
        }
        if (requestId === loadVersion.current)
          setLoadedKey(`${groupId}:${view}:${page}`);
      } catch (e) {
        if (requestId === loadVersion.current) fail(e);
      } finally {
        if (requestId === loadVersion.current) setLoading(false);
      }
    },
    [groupId, base, view, page, admin, signed, fail, calendarMonthKey],
  );
  const cancelViewLoad = useCallback(() => {
    loadVersion.current++;
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the external API subscription for this route and preserve its loading state.
    void load();
    return cancelViewLoad;
  }, [load, cancelViewLoad, detailId, detailResource]);
  useEffect(() => {
    if (!signed) return;
    let lastRefresh = Date.now();
    const refresh = () => {
      if (
        globalThis.document.visibilityState !== "visible" ||
        busyRef.current ||
        Date.now() - lastRefresh < 30000
      )
        return;
      lastRefresh = Date.now();
      void load(true);
    };
    window.addEventListener("focus", refresh);
    globalThis.document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      globalThis.document.removeEventListener("visibilitychange", refresh);
    };
  }, [signed, load]);
  const changeGroup = (id: string) => {
    loadVersion.current++;
    setLoadedKey("");
    sessionVersion.current++;
    detailVersion.current++;
    setMessageLoading(false);
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
    loadVersion.current++;
    detailVersion.current++;
    setLoading(false);
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
    const routeView = viewFromPath(pathname);
    const next = routeView === "챗봇" ? "홈" : routeView;
    if (
      !next ||
      (next === view && (detailFromPath(pathname) || (!post && !event)))
    )
      return;
    detailOrigin.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize persistent workspace state with external browser navigation.
    setView(next);
    setPage(0);
    setPost(null);
    setEvent(null);
    setDocument(null);
    setError("");
  }, [pathname, view, post, event]);
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
        const post = await api<Post>(
          `groups/${item.group_id}/posts/${item.id}`,
        );
        if (
          version !== activityVersion.current ||
          getApiScope() !== item.group_id
        )
          return;
        setPost(post);
        navigateWorkspace("커뮤니티", item.group_id, true, post.id);
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
    loadVersion.current++;
    const version = ++detailVersion.current;
    setLoading(true);
    setError("");
    try {
      const detail = await api<Post>(`${base}/posts/${p.id}`);
      if (version !== detailVersion.current) return;
      setPost(detail);
      setLoadedKey(`${groupId}:커뮤니티:${page}:${p.id}`);
      detailOrigin.current = { view, page };
      navigateWorkspace("커뮤니티", groupId, false, p.id);
      setView("커뮤니티");
    } catch (e) {
      if (version === detailVersion.current) fail(e);
    } finally {
      if (version === detailVersion.current) setLoading(false);
    }
  }
  async function openEvent(e: Event) {
    loadVersion.current++;
    const version = ++detailVersion.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ user_id: string; status: string }[]>(
        `${base}/events/${e.id}/attendance`,
      );
      if (version !== detailVersion.current) return;
      setAttendance(result);
      setEvent(e);
      setLoadedKey(`${groupId}:일정:${page}:${e.id}`);
      detailOrigin.current = { view, page };
      navigateWorkspace("일정", groupId, false, e.id);
      setView("일정");
    } catch (e) {
      if (version === detailVersion.current) fail(e);
    } finally {
      if (version === detailVersion.current) setLoading(false);
    }
  }
  async function openDocument(id: string) {
    const version = ++detailVersion.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<Document>(`${base}/documents/${id}`);
      if (version !== detailVersion.current) return;
      setDocument(result);
      detailOrigin.current = { view, page };
      navigateWorkspace("자료", groupId);
      setView("자료");
    } catch (e) {
      if (version === detailVersion.current) fail(e);
    } finally {
      if (version === detailVersion.current) setLoading(false);
    }
  }
  function goBackFromDetail() {
    loadVersion.current++;
    detailVersion.current++;
    setLoading(false);
    const origin = detailOrigin.current;
    detailOrigin.current = null;
    setPost(null);
    setEvent(null);
    setDocument(null);
    if (origin && origin.view !== view) {
      window.history.back();
    } else {
      navigateWorkspace(view, groupId);
      if (origin) setPage(origin.page);
    }
  }
  async function openSession(id: string) {
    const version = ++sessionVersion.current;
    setMessageLoading(true);
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
      if (version !== sessionVersion.current) return;
      setSessionId(id);
      setMessagePage(lastPage);
      setMessages(latest.items);
    } catch (e) {
      if (version === sessionVersion.current) fail(e);
    } finally {
      if (version === sessionVersion.current) setMessageLoading(false);
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
      }).catch(async (error: unknown) => {
        if (error instanceof UploadInterruptedError) {
          await load();
          if (error.document.upload_completed) {
            setModal(null);
            setDocument(error.document);
          } else setModal({ kind: "pdf", item: error.document });
        }
        throw error;
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
      if (saved.event && event?.id === saved.event.id) setEvent(saved.event);
      if (active.kind === "post") {
        setPost(null);
        navigateWorkspace("커뮤니티", groupId, true);
      }
      if (active.kind === "documentEdit" && active.item)
        await openDocument(active.item.id);
      if (active.kind === "memo" || active.kind === "pdf")
        notify(
          "자료를 저장했어요. AI 반영 상태는 자료 목록에서 확인해 주세요.",
        );
      if (active.kind === "documentEdit")
        notify("변경사항을 저장했어요. AI 반영 상태를 확인해 주세요.");
      setModal(null);
      if (active.kind !== "group" && active.kind !== "join") await load();
      if (
        !["memo", "pdf", "group", "join", "documentEdit"].includes(active.kind)
      )
        notify("저장했습니다");
    });
  }

  useEffect(() => {
    const onBack = () => {
      detailVersion.current++;
      streamAbort.current?.abort();
      activityVersion.current++;
      const routeView = viewFromPath(window.location.pathname) || "홈";
      const next = routeView === "챗봇" ? "홈" : routeView;
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
      if (!detailFromPath(window.location.pathname)) {
        setPost(null);
        setEvent(null);
      }
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
            if (event.type === "usage") setAiUsage(event.usage);
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
        invalidateApiCache();
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
  const loadAssistant = useCallback(async () => {
    const version = ++assistantVersion.current;
    if (!signed || !groupId) return;
    setAssistantLoading(true);
    try {
      const result = await api<Page<Session>>(`${base}/chat/sessions?page=0`);
      if (version === assistantVersion.current) setSessions(result.items);
    } catch (e) {
      fail(e);
    } finally {
      if (version === assistantVersion.current) setAssistantLoading(false);
    }
  }, [signed, groupId, base, fail]);
  return {
    startConversation: () => {
      sessionVersion.current++;
      setMessageLoading(false);
      setSessionId("");
      setMessages([]);
      setMessagePage(0);
    },
    assistantLoading,
    messageLoading,
    streamingId,
    aiUsage,
    groupLimitOpen,
    setGroupLimitOpen,
    setAiUsage,
    streamStage,
    cancelAnswer: () => streamAbort.current?.abort(),
    loadAssistant,
    sendQuestion,
    busyRef,
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
    viewReady:
      view === "마이페이지" ||
      view === "설정" ||
      (loadedKey ===
        `${groupId}:${view}:${page}${detailId ? `:${detailId}` : ""}` &&
        (!detailId || post?.id === detailId || event?.id === detailId)),
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
