"use client";
import type { Comment, Post } from "./model";

import { UserIdentity, Badge, Card } from "@/shared/ui";
export function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  return (
    <Card className="post-card">
      <div className="row between">
        <Badge tone={post.kind === "notice" ? "brand" : ""}>
          {{ general: "일반", question: "질문", notice: "공지" }[post.kind]}
        </Badge>
        <small>{new Date(post.created_at).toLocaleDateString("ko-KR")}</small>
      </div>
      <button className="post-title" onClick={onOpen}>
        {post.title}
      </button>
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
export function CommentItem({
  comment,
  children,
}: {
  comment: Comment;
  children?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="row">
        <UserIdentity profile={comment.author} id={comment.author_id} />
        <small>{new Date(comment.created_at).toLocaleString("ko-KR")}</small>
        {children}
      </div>
      <p className="body">{comment.body}</p>
    </div>
  );
}
