"use client";
import { PostCard } from "@/entities/post";

import { DiscussionSection } from "@/features/discussion/ui/discussion-section";
import {
  Icon,
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
    view,
    posts,
    post,
    goBackFromDetail,
    setModal,
    setConfirm,
    total,
    admin,
    base,
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
          <section className="community-detail">
            <div className="event-detail-toolbar">
              <Button variant="ghost" onClick={goBackFromDetail}>
                <Icon name="arrow" className="icon-back" size={17} />
                커뮤니티로 돌아가기
              </Button>
              {canEdit(post.author_id) && (post.kind !== "notice" || admin) && (
                <div className="row">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setModal({ kind: "post", item: post })}
                  >
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      setConfirm({
                        title: "게시글을",
                        path: `${base}/posts/${post.id}`,
                        after: goBackFromDetail,
                      })
                    }
                  >
                    삭제
                  </Button>
                </div>
              )}
            </div>
            <Card className="community-detail-content">
              <header>
                <Badge tone={post.kind === "notice" ? "brand" : ""}>
                  {
                    { general: "일반", question: "질문", notice: "공지" }[
                      post.kind
                    ]
                  }
                </Badge>
                <h1>{post.title}</h1>
                <div className="community-detail-meta">
                  <UserIdentity profile={post.author} id={post.author_id} />
                  <time dateTime={post.created_at}>
                    {new Date(post.created_at).toLocaleString("ko-KR")}
                  </time>
                </div>
              </header>
              <div className="community-detail-body">
                <p className="body">{post.body}</p>
              </div>
            </Card>
            <DiscussionSection
              key={`${base}/posts/${post.id}`}
              path={`${base}/posts/${post.id}/comments`}
              me={model.me}
              profile={model.profile}
              admin={admin}
              notify={model.notify}
            />
          </section>
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
                    illustration="community"
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
