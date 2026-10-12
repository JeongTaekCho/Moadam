"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/shared/api";
import type { Comment, Page, PublicProfile } from "@/shared/api";
import { Button, Card, Textarea, UserIdentity, Icon } from "@/shared/ui";

type EditorMode = { kind: "reply" | "edit"; comment: Comment };
function CommentEditor({
  initialValue = "",
  label,
  pending,
  onSave,
  onCancel,
}: {
  initialValue?: string;
  label: string;
  pending: boolean;
  onSave: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initialValue);
  const [error, setError] = useState("");
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (onCancel) editor.current?.querySelector("textarea")?.focus();
  }, [onCancel]);
  async function submit() {
    if (pending || !body.trim()) return;
    setError("");
    try {
      if (await onSave(body.trim())) {
        setBody("");
        editor.current?.querySelector("textarea")?.focus();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "등록하지 못했어요. 다시 시도해 주세요.",
      );
    }
  }
  return (
    <form
      className="comment-editor"
      ref={editor}
      aria-label={`${label} 에디터`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Textarea
        label={label}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          onCancel
            ? "답변을 남겨 주세요."
            : "모임에 나누고 싶은 이야기를 남겨 주세요."
        }
        rows={3}
        maxLength={5000}
        disabled={pending}
        error={error}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape" && onCancel && !pending) onCancel();
        }}
      />
      <div className="comment-editor-footer">
        <small>
          {body.length.toLocaleString()} / 5,000{" "}
          <span>· Ctrl/⌘ + Enter로 등록</span>
        </small>
        <div className="row">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={pending}
              onClick={onCancel}
            >
              취소
            </Button>
          )}
          <Button
            type="submit"
            size="small"
            loading={pending}
            disabled={!body.trim()}
          >
            {initialValue ? "수정 저장" : onCancel ? "답글 등록" : "댓글 등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}
export function DiscussionSection({
  path,
  me,
  profile,
  admin,
  notify,
}: {
  path: string;
  me: string;
  profile: PublicProfile | null;
  admin: boolean;
  notify: (message: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0),
    [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [pending, setPending] = useState(false),
    [mode, setMode] = useState<EditorMode | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const scope = useRef({ active: true });
  const mutationLock = useRef(false);
  const load = useCallback(
    async (nextPage = 0, signal?: AbortSignal) => {
      const current = scope.current;
      try {
        const result = await api<Page<Comment>>(
          `${path}?size=100&page=${nextPage}`,
          "GET",
          undefined,
          signal,
        );
        if (!current.active || current !== scope.current) return;
        setComments((old) => [
          ...new Map(
            [...(nextPage ? old : []), ...result.items].map((comment) => [
              comment.id,
              comment,
            ]),
          ).values(),
        ]);
        setTotal(result.total);
        setPage(nextPage);
      } catch (error) {
        if (current.active && current === scope.current && !signal?.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "댓글을 불러오지 못했어요.",
          );
      } finally {
        if (current.active && current === scope.current && !signal?.aborted)
          setLoading(false);
      }
    },
    [path],
  );
  useEffect(() => {
    const current = { active: true };
    scope.current = current;
    const controller = new AbortController();
    void api<Page<Comment>>(
      `${path}?size=100&page=0`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!current.active) return;
        setComments(result.items);
        setTotal(result.total);
        setPage(0);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!current.active || controller.signal.aborted) return;
        setError(
          error instanceof Error ? error.message : "댓글을 불러오지 못했어요.",
        );
        setLoading(false);
      });
    return () => {
      current.active = false;
      controller.abort();
    };
  }, [path]);
  async function save(body: string, active?: EditorMode) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setPending(true);
    const current = scope.current;
    try {
      const saved = await api<Comment>(
        `${path}${active?.kind === "edit" ? `/${active.comment.id}` : ""}`,
        active?.kind === "edit" ? "PATCH" : "POST",
        {
          body,
          ...(active?.kind === "reply"
            ? { parent_id: active.comment.parent_id || active.comment.id }
            : {}),
        },
      );
      if (!current.active || current !== scope.current) return false;
      setComments((old) => [
        ...new Map(
          [...old, saved].map((comment) => [comment.id, comment]),
        ).values(),
      ]);
      if (active?.kind !== "edit") setTotal((count) => count + 1);
      setMode(null);
      notify(
        active?.kind === "edit"
          ? "댓글을 수정했습니다"
          : active
            ? "답글을 등록했습니다"
            : "댓글을 등록했습니다",
      );
      return true;
    } finally {
      mutationLock.current = false;
      if (current.active && current === scope.current) setPending(false);
    }
  }
  async function remove(comment: Comment) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    const current = scope.current;
    try {
      await api(`${path}/${comment.id}`, "DELETE");
      if (!current.active || current !== scope.current) return;
      setComments((old) =>
        old.map((item) =>
          item.id === comment.id
            ? { ...item, body: "삭제된 댓글입니다", deleted: true }
            : item,
        ),
      );
      setDeleting(null);
      setMode(null);
      notify("댓글을 삭제했습니다");
    } catch (error) {
      if (current.active && current === scope.current)
        setError(error instanceof Error ? error.message : "삭제하지 못했어요.");
    } finally {
      mutationLock.current = false;
      if (current.active && current === scope.current) setPending(false);
    }
  }
  const cancel = () => setMode(null);
  function item(comment: Comment, reply = false, replyAllowed = true) {
    return (
      <article
        key={comment.id}
        className={`discussion-comment ${reply ? "is-reply" : ""}`}
        data-comment-id={comment.id}
      >
        <div className="comment-heading">
          <UserIdentity profile={comment.author} id={comment.author_id} />
          <time dateTime={comment.created_at}>
            {new Date(comment.created_at).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {comment.updated_at !== comment.created_at &&
              !comment.deleted &&
              " · 수정됨"}
          </time>
        </div>
        {mode?.kind === "edit" && mode.comment.id === comment.id ? (
          <CommentEditor
            key={`edit-${comment.id}`}
            label="댓글 수정"
            initialValue={comment.body}
            pending={pending || loading}
            onCancel={cancel}
            onSave={(body) => save(body, mode)}
          />
        ) : (
          <p className={`body comment-body ${comment.deleted ? "muted" : ""}`}>
            {comment.deleted ? "삭제된 댓글입니다" : comment.body}
          </p>
        )}
        {!comment.deleted && (
          <div className="comment-actions">
            <Button
              size="small"
              variant="ghost"
              disabled={pending || !replyAllowed}
              title={
                replyAllowed
                  ? "답글 작성"
                  : "원댓글이 삭제되어 새 답글을 작성할 수 없어요"
              }
              onClick={() => setMode({ kind: "reply", comment })}
            >
              답글
            </Button>
            {(admin || comment.author_id === me) && (
              <>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setMode({ kind: "edit", comment })}
                >
                  수정
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setDeleting(comment.id)}
                >
                  삭제
                </Button>
              </>
            )}
          </div>
        )}
        {deleting === comment.id && (
          <div
            className="comment-delete-confirm"
            role="group"
            aria-label="댓글 삭제 확인"
          >
            <span>댓글을 삭제할까요? 답글은 남아요.</span>
            <Button
              variant="ghost"
              size="small"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              size="small"
              loading={pending}
              onClick={() => void remove(comment)}
            >
              삭제 확인
            </Button>
          </div>
        )}
      </article>
    );
  }
  const roots = comments.filter((comment) => !comment.parent_id);
  return (
    <Card className="discussion-section">
      <div className="discussion-heading">
        <Icon name="posts" size={20} />
        <h2>
          댓글 <span>{total}</span>
        </h2>
      </div>
      <div className="discussion-composer">
        <UserIdentity profile={profile} id={me} />
        <CommentEditor
          label="댓글 작성"
          pending={pending || loading}
          onSave={(body) => save(body)}
        />
      </div>
      {error && (
        <div className="comment-load-error" role="alert">
          {error}
          <Button
            size="small"
            variant="ghost"
            onClick={() => {
              setLoading(true);
              setError("");
              void load(page);
            }}
          >
            다시 시도
          </Button>
        </div>
      )}
      {loading && !comments.length ? (
        <div
          className="discussion-skeleton"
          aria-label="댓글 불러오는 중"
          aria-busy="true"
        >
          <div />
          <div />
          <div />
        </div>
      ) : !comments.length && !error ? (
        <p className="discussion-empty">
          아직 댓글이 없어요. 첫 이야기를 남겨 보세요.
        </p>
      ) : (
        <div className="discussion-threads">
          {roots.map((root) => {
            const replies = comments.filter(
              (comment) => comment.parent_id === root.id,
            );
            const active =
              mode?.kind === "reply" &&
              (mode.comment.parent_id || mode.comment.id) === root.id
                ? mode
                : null;
            return (
              <div className="discussion-thread" key={root.id}>
                {item(root)}
                {replies.length > 0 && (
                  <div className="discussion-replies">
                    {replies.map((reply) => item(reply, true, !root.deleted))}
                  </div>
                )}
                {active && (
                  <div className="reply-composer">
                    <p>
                      <Icon name="arrow" size={15} />
                      {active.comment.author?.display_name || "모아"}님에게 답글
                    </p>
                    <CommentEditor
                      key={`reply-${active.comment.id}`}
                      label="답글 작성"
                      pending={pending || loading}
                      onCancel={cancel}
                      onSave={(body) => save(body, active)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {comments.length < total && (
        <Button
          variant="secondary"
          loading={loading}
          disabled={pending}
          onClick={() => {
            setLoading(true);
            setError("");
            void load(page + 1);
          }}
        >
          댓글 더 보기
        </Button>
      )}
    </Card>
  );
}
