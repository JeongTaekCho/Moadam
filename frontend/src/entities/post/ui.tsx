"use client";
import type { Post } from "./model";

import { UserIdentity, Badge, Card } from "@/shared/ui";
export function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  return (
    <Card className="post-card">
      <button
        type="button"
        className="post-card-link"
        aria-label={post.title}
        onClick={onOpen}
      />
      <div className="row between">
        <Badge tone={post.kind === "notice" ? "brand" : ""}>
          {{ general: "일반", question: "질문", notice: "공지" }[post.kind]}
        </Badge>
        <small>{new Date(post.created_at).toLocaleDateString("ko-KR")}</small>
      </div>
      <h2 className="post-title">{post.title}</h2>
      <p className="muted">{post.body.slice(0, 120)}</p>
      <div className="row">
        <UserIdentity
          profile={post.author}
          id={post.author_id}
          label="작성자"
        />
      </div>
    </Card>
  );
}
