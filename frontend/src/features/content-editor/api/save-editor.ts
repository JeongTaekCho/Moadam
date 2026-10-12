import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Group } from "@/entities/group";
import { api } from "@/shared/api";
import { koreaDateKey, koreaLocalInputToUtc } from "@/shared/lib/form";

import type { Modal } from "../model/types";
type Input = {
  active: Modal;
  fields: Record<string, string>;
  file?: File;
  base: string;
  postId?: string;
};
export async function saveEditor({
  active,
  fields: b,
  file,
  base,
  postId,
}: Input): Promise<{ group?: Group; event?: Event }> {
  switch (active.kind) {
    case "group":
      return {
        group: await api<Group>("groups", "POST", {
          name: b.name,
          timezone: "Asia/Seoul",
        }),
      };
    case "join":
      return {
        group: await api<Group>("invites/join", "POST", { token: b.token }),
      };
    case "post":
      await api(
        `${base}/posts${active.item ? "/" + active.item.id : ""}`,
        active.item ? "PATCH" : "POST",
        b,
      );
      break;
    case "comment":
      if (!postId) throw new Error("게시글을 다시 열어 주세요");
      await api(
        `${base}/posts/${postId}/comments${active.item ? "/" + active.item.id : ""}`,
        active.item ? "PATCH" : "POST",
        { body: b.body },
      );
      break;
    case "event": {
      if (b.starts_at.slice(0, 10) < koreaDateKey(new Date()))
        throw new Error("오늘 이전 날짜로 일정을 만들 수 없습니다");
      if (koreaLocalInputToUtc(b.ends_at) <= koreaLocalInputToUtc(b.starts_at))
        throw new Error("종료 시간은 시작 시간보다 늦어야 합니다");
      const event = await api<Event>(
        `${base}/events${active.item ? "/" + active.item.id : ""}`,
        active.item ? "PATCH" : "POST",
        {
          title: b.title,
          description: b.description,
          location: b.location,
          starts_at: koreaLocalInputToUtc(b.starts_at),
          ends_at: koreaLocalInputToUtc(b.ends_at),
        },
      );
      return { event };
    }
    case "documentEdit":
      await api(`${base}/documents/${active.item?.id}`, "PATCH", {
        title: b.title,
        text: b.text,
      });
      break;
    case "memo": {
      const d = await api<Document>(`${base}/documents`, "POST", {
        title: b.title,
        kind: "memo",
        text: b.text,
      });
      await api(`${base}/documents/${d.id}/index`, "POST", {});
      break;
    }
    case "pdf": {
      if (
        !file ||
        file.type !== "application/pdf" ||
        file.size > 20971520 ||
        !file.size
      )
        throw new Error("20MB 이하 PDF를 선택해 주세요");
      const u = await api<{ document: Document; upload_url: string }>(
        `${base}/documents/uploads`,
        "POST",
        {
          title: b.title,
          filename: file.name,
          mime: file.type,
          size: file.size,
        },
      );
      const response = await fetch(u.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!response.ok)
        throw new Error(
          "파일 업로드 실패. 대기 자료를 삭제하고 다시 시도해 주세요.",
        );
      await api(`${base}/documents/${u.document.id}/complete`, "POST", {});
      break;
    }
  }
  return {};
}
