import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Group } from "@/entities/group";
import { api } from "@/shared/api";
import { koreaDateKey, koreaLocalInputToUtc } from "@/shared/lib/form";

import type { Modal } from "../model/types";
export class UploadInterruptedError extends Error {
  constructor(
    public document: Document,
    reason?: string,
  ) {
    super(
      document.upload_completed
        ? "파일은 저장했어요. " +
            (reason ||
              "AI 반영을 시작하지 못했어요. 자료 상세에서 다시 처리해 주세요.")
        : "업로드를 완료하지 못했어요. 같은 자료에서 파일을 다시 선택해 이어서 진행해 주세요.",
    );
  }
}
type Input = {
  active: Modal;
  fields: Record<string, string>;
  file?: File;
  base: string;
};
export async function saveEditor({
  active,
  fields: b,
  file,
  base,
}: Input): Promise<{ group?: Group; event?: Event }> {
  switch (active.kind) {
    case "group":
      return {
        group: await api<Group>("groups", "POST", {
          name: b.name,
          timezone: "Asia/Seoul",
          max_members: Number(b.max_members),
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
    case "event": {
      if (b.event_date_error) throw new Error(b.event_date_error);
      if (b.starts_at.slice(0, 10) < koreaDateKey(new Date()))
        throw new Error(
          "시작일이 오늘보다 전입니다. 시작일을 오늘 또는 이후 날짜로 수정해 주세요.",
        );
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
      void d;
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
        active.item
          ? `${base}/documents/${active.item.id}/upload-url`
          : `${base}/documents/uploads`,
        "POST",
        {
          title: b.title,
          filename: file.name,
          mime: file.type,
          size: file.size,
        },
      );
      try {
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
      } catch (cause) {
        const saved = await api<Document>(
          `${base}/documents/${u.document.id}`,
        ).catch(() => u.document);
        throw new UploadInterruptedError(
          saved,
          cause instanceof Error ? cause.message : undefined,
        );
      }
      break;
    }
  }
  return {};
}
