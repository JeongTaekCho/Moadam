"use client";
import type { Comment } from "@/entities/post";
import { CommentItem, PostCard } from "@/entities/post";
import type { Page } from "@/shared/api";

import { api } from "@/shared/api";
import {
  UserIdentity,
  Badge,
  Button,
  Card,
  EmptyState,
  FilterChips,
  ListSearch,
} from "@/shared/ui";
import { useState } from "react";
import type { WorkspaceModel } from "../model/use-workspace";
export function CommunityView({ model }: { model: WorkspaceModel }) {
  const {
    commentPage,
    setCommentPage,
    commentTotal,
    view,
    posts,
    post,
    setPost,
    goBackFromDetail,
    comments,
    setComments,
    busy,
    setModal,
    setConfirm,
    total,
    admin,
    base,
    run,
    canEdit,
    openPost,
  } = model;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filteredPosts = posts.filter(
    (p) =>
      (filter === "all" || p.kind === filter) &&
      (p.title + " " + p.body)
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      {view === "커뮤니티" &&
        (post ? (
          <Card>
            <Button variant="ghost" onClick={goBackFromDetail}>
              ← 이전 페이지
            </Button>
            <Badge tone={post.kind === "notice" ? "brand" : ""}>
              {{ general: "일반", question: "질문", notice: "공지" }[post.kind]}
            </Badge>
            <h1>{post.title}</h1>
            <p className="body">{post.body}</p>
            <small>
              <UserIdentity
                profile={post.author}
                id={post.author_id}
                label="작성자"
              />{" "}
              · {new Date(post.created_at).toLocaleString("ko-KR")}
            </small>
            {canEdit(post.author_id) && (post.kind !== "notice" || admin) && (
              <div className="row">
                <Button
                  variant="secondary"
                  onClick={() => setModal({ kind: "post", item: post })}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setConfirm({
                      title: "게시글을",
                      path: `${base}/posts/${post.id}`,
                      after: () => setPost(null),
                    })
                  }
                >
                  삭제
                </Button>
              </div>
            )}
            <div className="comments">
              <h2>댓글 {commentTotal}</h2>
              {comments.length < commentTotal && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    void run(async () => {
                      const next = await api<Page<Comment>>(
                        `${base}/posts/${post.id}/comments?size=100&page=${commentPage + 1}`,
                      );
                      setComments((old) => [...old, ...next.items]);
                      setCommentPage(commentPage + 1);
                    })
                  }
                >
                  댓글 더 보기
                </Button>
              )}
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c}>
                  {canEdit(c.author_id) && (
                    <>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => setModal({ kind: "comment", item: c })}
                      >
                        수정
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() =>
                          setConfirm({
                            title: "댓글을",
                            path: `${base}/posts/${post.id}/comments/${c.id}`,
                            after: () => void openPost(post),
                          })
                        }
                      >
                        삭제
                      </Button>
                    </>
                  )}
                </CommentItem>
              ))}
              <Button onClick={() => setModal({ kind: "comment" })}>
                댓글 작성
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="row between">
              <p className="muted">
                소식과 질문을 나누세요. 공지가 먼저 표시됩니다.
              </p>
              <Button onClick={() => setModal({ kind: "post" })}>
                + 글 작성
              </Button>
            </div>
            <div className="list-toolbar">
              <FilterChips
                value={filter}
                onChange={setFilter}
                items={[
                  { value: "all", label: "전체 이야기" },
                  { value: "notice", label: "공지" },
                  { value: "general", label: "일반" },
                  { value: "question", label: "질문" },
                ]}
              />
              <ListSearch value={search} onChange={setSearch} />
            </div>
            <div className="surface-list">
              {filteredPosts.length ? (
                filteredPosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    onOpen={() => void openPost(p)}
                  />
                ))
              ) : (
                <Card>
                  <EmptyState
                    title={
                      posts.length
                        ? "조건에 맞는 글이 없어요"
                        : "아직 글이 없어요"
                    }
                    description="첫 이야기를 시작해 보세요."
                  />
                </Card>
              )}
            </div>
            <p className="list-meta">
              현재 페이지의 이야기 {filteredPosts.length}개 · 전체 {total}개
            </p>
          </>
        ))}
    </>
  );
}
