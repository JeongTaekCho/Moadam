"use client";
import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Comment, Post } from "@/entities/post";

import { localInput } from "@/shared/lib/form";
import {
  Button,
  Dialog,
  ErrorState,
  Select,
  TextField,
  Textarea,
} from "@/shared/ui";
import type { FormEvent } from "react";
import type { Modal } from "../model/types";
export function EditorDialog({
  modal,
  busy,
  error,
  admin,
  onClose,
  submit,
}: {
  modal: Modal | null;
  busy: boolean;
  error: string;
  admin: boolean;
  onClose: () => void;
  submit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <>
      {modal && (
        <Dialog
          title={
            {
              group: "모임 만들기",
              join: "초대 참여",
              post: modal.item ? "게시글 수정" : "새 게시글",
              event: modal.item ? "일정 수정" : "새 일정",
              memo: "메모 작성",
              pdf: "PDF 업로드",
              comment: modal.item ? "댓글 수정" : "댓글 작성",
              documentEdit: "자료 수정",
            }[modal.kind]
          }
          onClose={() => !busy && onClose()}
        >
          <form onSubmit={submit}>
            {error && <ErrorState message={error} />}{" "}
            {modal.kind === "group" && (
              <>
                <TextField
                  label="모임 이름"
                  name="name"
                  maxLength={100}
                  required
                />
                <p className="form-hint">
                  모임 일정은 한국 표준시(KST, UTC+9) 기준입니다.
                </p>
              </>
            )}
            {modal.kind === "join" && (
              <TextField label="초대 코드" name="token" required />
            )}
            {modal.kind === "post" && (
              <>
                <TextField
                  label="제목"
                  name="title"
                  defaultValue={(modal.item as Post)?.title}
                  maxLength={200}
                  required
                />
                <Select
                  label="글 종류"
                  name="kind"
                  defaultValue={(modal.item as Post)?.kind || "general"}
                >
                  <option value="general">일반</option>
                  <option value="question">질문</option>
                  {admin && <option value="notice">공지</option>}
                </Select>
                <Textarea
                  label="내용"
                  name="body"
                  defaultValue={(modal.item as Post)?.body}
                  maxLength={20000}
                  required
                />
              </>
            )}
            {modal.kind === "comment" && (
              <Textarea
                label="댓글"
                name="body"
                defaultValue={(modal.item as Comment)?.body}
                maxLength={5000}
                required
              />
            )}
            {modal.kind === "event" && (
              <>
                <TextField
                  label="일정 제목"
                  name="title"
                  defaultValue={(modal.item as Event)?.title}
                  maxLength={200}
                  required
                />
                <Textarea
                  label="설명"
                  name="description"
                  defaultValue={(modal.item as Event)?.description}
                />
                <TextField
                  label="장소"
                  name="location"
                  defaultValue={(modal.item as Event)?.location}
                />
                <p className="muted">
                  입력과 표시는 한국 표준시(KST, UTC+9) 기준입니다. 저장 시
                  UTC로 변환됩니다.
                </p>
                <TextField
                  label="시작"
                  name="starts_at"
                  type="datetime-local"
                  defaultValue={localInput((modal.item as Event)?.starts_at)}
                  required
                />
                <TextField
                  label="종료"
                  name="ends_at"
                  type="datetime-local"
                  defaultValue={localInput((modal.item as Event)?.ends_at)}
                  required
                />
              </>
            )}
            {["memo", "pdf", "documentEdit"].includes(modal.kind) && (
              <TextField
                label="자료 제목"
                name="title"
                defaultValue={(modal.item as Document)?.title}
                maxLength={200}
                required
              />
            )}
            {(modal.kind === "memo" ||
              (modal.kind === "documentEdit" &&
                (modal.item as Document)?.kind === "memo")) && (
              <Textarea
                label="메모 본문"
                name="text"
                defaultValue={(modal.item as Document)?.text_content ?? ""}
                maxLength={100000}
                required
              />
            )}
            {modal.kind === "pdf" && (
              <TextField
                label="PDF 파일 (최대 20MB)"
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            )}
            <Button loading={busy}>저장</Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
