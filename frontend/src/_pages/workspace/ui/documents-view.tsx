"use client";
import {
  DocumentRow,
  StatusBadge,
  documentErrorMessage,
} from "@/entities/document";
import type { Document } from "@/entities/document";
import { api, type Page } from "@/shared/api";
import {
  UserIdentity,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  ListSearch,
  MoaAiIcon,
} from "@/shared/ui";
import { useState, useEffect } from "react";
import type { WorkspaceModel } from "../model/use-workspace";
export function DocumentsView({ model }: { model: WorkspaceModel }) {
  const {
    view,
    documents,
    document,
    setDocument,
    goBackFromDetail,
    busy,
    setModal,
    setConfirm,
    total,
    admin,
    base,
    notify,
    run,
    openDocument,
  } = model;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const pending = (document ? [document] : documents).some(
    (item) =>
      item.upload_completed !== false &&
      item.processing_active !== false &&
      ["pending", "processing"].includes(item.status),
  );
  const setDocuments = model.setDocuments;
  const page = model.page;
  const detailId = document?.id;
  useEffect(() => {
    if (!pending || view !== "자료") return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || globalThis.document.visibilityState !== "visible") return;
      running = true;
      try {
        if (detailId)
          setDocument(
            await api<Document>(
              `${base}/documents/${detailId}?status_poll=1`,
              "GET",
              undefined,
              controller.signal,
            ),
          );
        else
          setDocuments(
            (
              await api<Page<Document>>(
                `${base}/documents?page=${page}&size=20&status_poll=1`,
                "GET",
                undefined,
                controller.signal,
              )
            ).items,
          );
      } catch {
        /* Keep the current content; manual retry remains available. */
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    globalThis.document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      globalThis.document.removeEventListener("visibilitychange", refresh);
    };
  }, [pending, view, base, page, detailId, setDocument, setDocuments]);
  const filteredDocuments = documents.filter(
    (d) =>
      (filter === "all" || d.kind === filter || d.status === filter) &&
      d.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      {view === "자료" &&
        (document ? (
          <Card>
            <Button variant="ghost" onClick={goBackFromDetail}>
              ← 이전 페이지
            </Button>
            <StatusBadge
              status={document.status}
              uploadCompleted={document.upload_completed !== false}
              processingActive={document.processing_active !== false}
            />
            <h1>{document.title}</h1>
            <UserIdentity
              profile={document.author}
              id={document.author_id}
              label="등록자"
            />
            {document.error_code && (
              <ErrorState message={documentErrorMessage(document.error_code)} />
            )}
            <p className="body">
              {document.text_content ||
                "PDF 자료입니다. 다운로드 링크는 60초 후 만료됩니다."}
            </p>
            <div className="row">
              {document.kind === "pdf" && (
                <Button
                  onClick={() =>
                    void run(async () => {
                      const d = await api<{ url: string }>(
                        `${base}/documents/${document.id}/download`,
                      );
                      window.open(d.url, "_blank", "noopener,noreferrer");
                    })
                  }
                >
                  PDF 열기
                </Button>
              )}
              {document.status === "ready" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void model.sendQuestion(
                      `"${document.title}" 자료의 핵심 내용을 설명해줘`,
                    )
                  }
                >
                  <MoaAiIcon size={20} />이 자료에 질문하기
                </Button>
              )}
              {admin && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setModal({ kind: "documentEdit", item: document })
                    }
                  >
                    수정
                  </Button>
                  {document.kind === "pdf" &&
                    document.upload_completed === false && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setModal({ kind: "pdf", item: document })
                        }
                      >
                        업로드 이어하기
                      </Button>
                    )}
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `${base}/documents/${document.id}/index`,
                          "POST",
                          {},
                        );
                        await openDocument(document.id);
                        notify("자료 처리 결과를 확인하세요");
                      })
                    }
                  >
                    {document.upload_completed === false
                      ? "업로드 완료 확인"
                      : "AI 반영 다시 시도"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setConfirm({
                        title: "자료를",
                        path: `${base}/documents/${document.id}`,
                        after: () => setDocument(null),
                      })
                    }
                  >
                    삭제
                  </Button>
                </>
              )}
            </div>
          </Card>
        ) : (
          <>
            <div className="row between">
              <p className="muted">
                모임 멤버만 열람할 수 있는 비공개 지식 보관함
              </p>
              {admin && (
                <div className="row">
                  <Button
                    variant="secondary"
                    onClick={() => setModal({ kind: "memo" })}
                  >
                    + 메모
                  </Button>
                  <Button onClick={() => setModal({ kind: "pdf" })}>
                    PDF 업로드
                  </Button>
                </div>
              )}
            </div>
            <div className="list-toolbar">
              <FilterChips
                value={filter}
                onChange={setFilter}
                items={[
                  { value: "all", label: "전체 자료" },
                  { value: "pdf", label: "PDF" },
                  { value: "memo", label: "메모" },
                  { value: "ready", label: "사용 가능" },
                  { value: "failed", label: "처리 실패" },
                ]}
              />
              <ListSearch value={search} onChange={setSearch} />
            </div>
            <div className="document-table">
              <div className="document-table-header">
                <span>자료 이름</span>
                <span>등록일</span>
                <span>처리 상태</span>
              </div>
              {filteredDocuments.length ? (
                filteredDocuments.map((d) => (
                  <DocumentRow
                    key={d.id}
                    document={d}
                    onOpen={() => void openDocument(d.id)}
                  />
                ))
              ) : (
                <Card>
                  <EmptyState
                    illustration="documents"
                    title={
                      documents.length
                        ? "조건에 맞는 자료가 없어요"
                        : "자료가 없어요"
                    }
                    description={
                      admin
                        ? "PDF나 메모를 등록하면 모아AI의 답변 근거가 됩니다."
                        : "관리자에게 자료 등록을 요청해 주세요."
                    }
                  />
                </Card>
              )}
            </div>
            <p className="list-meta">
              현재 페이지의 자료 {filteredDocuments.length}개 · 전체 {total}개
            </p>
            <small>
              PDF 20MB / 200쪽 이하. 텍스트 추출이 필요하며 스캔 PDF OCR은
              지원하지 않습니다.
            </small>
          </>
        ))}
    </>
  );
}
