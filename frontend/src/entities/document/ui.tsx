"use client";
import type { Document } from "./model";

import { Badge, Icon } from "@/shared/ui";
export function StatusBadge({ status }: { status: Document["status"] }) {
  return (
    <Badge
      tone={
        status === "ready"
          ? "success"
          : status === "failed"
            ? "danger"
            : "warning"
      }
    >
      {
        {
          pending: "등록 대기",
          processing: "자료를 읽는 중",
          ready: "도우미 사용 가능",
          failed: "처리 실패",
        }[status]
      }
    </Badge>
  );
}
export function DocumentRow({
  document,
  onOpen,
}: {
  document: Document;
  onOpen: () => void;
}) {
  return (
    <div className="document-row">
      <div className="document-primary">
        <span className={`file-icon ${document.kind}`}>
          <Icon name={document.kind === "pdf" ? "file" : "posts"} size={19} />
        </span>
        <div>
          <button className="post-title" onClick={onOpen}>
            {document.title}
          </button>
          <small>{document.kind === "pdf" ? "PDF 문서" : "텍스트 메모"}</small>
        </div>
      </div>
      <time className="document-date" dateTime={document.created_at}>
        {new Date(document.created_at).toLocaleDateString("ko-KR")}
      </time>
      <StatusBadge status={document.status} />
      {document.error_code && (
        <span className="document-error">
          {document.error_code === "NO_TEXT_OCR_UNSUPPORTED"
            ? "텍스트를 읽을 수 없는 PDF입니다. 텍스트가 포함된 파일을 등록해 주세요."
            : "자료를 처리하지 못했어요. 상세 화면에서 다시 처리해 주세요."}
        </span>
      )}
    </div>
  );
}
