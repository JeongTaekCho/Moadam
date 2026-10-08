"use client";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  api,
  invalidateApiCache,
  type MyProfile,
  type MyActivity,
  type Page,
} from "@/shared/api";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  TextField,
} from "@/shared/ui";
import { ContentSkeleton } from "@/shared/ui/skeleton";
import type { WorkspaceModel } from "../model/use-workspace";

export function MyPageView({ model: m }: { model: WorkspaceModel }) {
  const [kind, setKind] = useState<"posts" | "documents">("posts");
  const [page, setPage] = useState(0);
  const [activity, setActivity] = useState<Page<MyActivity> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!m.signed || !m.me) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setActivity(null);
    // Let immediate effect cleanup cancel before dispatching the request.
    Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return api<Page<MyActivity>>(
          `me/activity?type=${kind}&page=${page}`,
          "GET",
          undefined,
          controller.signal,
        );
      })
      .then((result) => {
        if (active) setActivity(result);
      })
      .catch((error) => {
        if (active && error instanceof ApiError && error.status === 401)
          m.fail(error);
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "내 활동을 불러오지 못했습니다",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, page, reload, m.signed, m.me, m.fail]);
  const profile = m.profile;
  if (!profile) return null;
  return (
    <div className="mypage-layout">
      <Card className="profile-card">
        <div className="profile-heading">
          <button
            type="button"
            className="profile-photo-button"
            aria-label="프로필 사진 변경"
            title="프로필 사진 변경"
            disabled={m.busy}
            onClick={() => fileRef.current?.click()}
          >
            <Avatar
              name={profile.display_name}
              src={profile.avatar_url}
              className="avatar-large"
            />
            <span className="profile-photo-edit" aria-hidden="true">
              <Icon name="camera" size={14} />
            </span>
          </button>
          <h2>{profile.display_name}</h2>
        </div>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg"
          tabIndex={-1}
          aria-label="프로필 사진 선택"
          disabled={m.busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void m.run(async () => {
              if (
                !["image/png", "image/jpeg"].includes(file.type) ||
                file.size > 2097152
              )
                throw new Error(
                  "2MB 이하의 PNG 또는 JPG 사진을 선택해 주세요.",
                );
              const body = new FormData();
              body.set("file", file);
              const response = await fetch("/api/proxy/me/avatar", {
                method: "POST",
                body,
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(result.message || "사진을 저장하지 못했습니다");
              invalidateApiCache();
              m.setProfile(result as MyProfile);
              m.notify("프로필 사진을 변경했습니다");
            });
          }}
        />
        <div className="row">
          {profile.avatar_url && (
            <Button
              type="button"
              variant="ghost"
              disabled={m.busy}
              onClick={() =>
                void m.run(async () => {
                  m.setProfile(await api<MyProfile>("me/avatar", "DELETE"));
                  m.notify("기본 프로필 이미지로 변경했습니다");
                })
              }
            >
              기본 이미지로
            </Button>
          )}
        </div>
        <p className="form-hint">
          PNG·JPG, 최대 2MB · 사진 중앙을 정사각형으로 표시합니다.
        </p>
        <form
          key={profile.updated_at}
          onSubmit={(event) => {
            event.preventDefault();
            const name = String(
              new FormData(event.currentTarget).get("display_name") || "",
            ).trim();
            void m.run(async () => {
              m.setProfile(
                await api<MyProfile>("me", "PATCH", { display_name: name }),
              );
              m.notify("닉네임을 변경했습니다");
            });
          }}
        >
          <TextField
            label="닉네임"
            name="display_name"
            defaultValue={profile.display_name}
            maxLength={30}
            required
            disabled={m.busy}
            autoComplete="nickname"
          />
          <p className="form-hint">
            최대 30자. 작성한 글과 등록한 자료에도 이 이름이 표시됩니다.
          </p>
          <Button loading={m.busy}>프로필 저장</Button>
        </form>
        <div className="profile-account-info">
          <h3 className="mypage-section-icon" title="내 계정 정보">
            <Icon name="lock" size={18} />
            <span className="sr-only">내 계정 정보</span>
          </h3>
          <dl>
            <dt>이메일</dt>
            <dd>{profile.email || "이메일 정보 없음"}</dd>
            <dt>가입일</dt>
            <dd>
              {new Date(profile.created_at).toLocaleDateString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </dd>
            <dt>참여 모임</dt>
            <dd>{m.groups.length}개</dd>
          </dl>
          <p className="form-hint">
            이메일은 내 마이페이지에서만 확인할 수 있어요.
          </p>
        </div>
      </Card>
      <Card className="my-activity-card">
        <div className="section-heading">
          <h2 className="mypage-section-icon" title="내가 남긴 기록">
            <Icon name="posts" size={19} />
            <span className="sr-only">내가 남긴 기록</span>
          </h2>
        </div>
        <div className="filter-chips" role="group" aria-label="내 활동 종류">
          {[
            { value: "posts", label: "커뮤니티 글" },
            { value: "documents", label: "등록한 자료" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={kind === tab.value ? "active" : ""}
              aria-pressed={kind === tab.value}
              onClick={() => {
                setKind(tab.value as typeof kind);
                setPage(0);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="form-hint">
          현재 참여 중인 모든 모임의 내 기록을 확인할 수 있어요.
        </p>
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              invalidateApiCache();
              setReload(reload + 1);
            }}
          />
        ) : loading ? (
          <ContentSkeleton
            view="마이페이지"
            label="내 활동을 불러오고 있어요"
          />
        ) : activity?.items.length ? (
          <>
            <div className="my-activity-list">
              {activity.items.map((item) => (
                <button
                  className="my-activity-item"
                  type="button"
                  key={item.id}
                  disabled={m.busy}
                  onClick={() => void m.openActivity(item, kind)}
                >
                  <span className="my-activity-icon">
                    <Icon name={kind === "posts" ? "posts" : "file"} />
                  </span>
                  <span>
                    <small>
                      {item.group_name} ·{" "}
                      {item.kind === "pdf"
                        ? "PDF"
                        : item.kind === "memo"
                          ? "메모"
                          : item.kind === "notice"
                            ? "공지"
                            : item.kind === "question"
                              ? "질문"
                              : "일반 글"}
                    </small>
                    <strong>{item.title}</strong>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </time>
                  </span>
                  <Icon name="arrow" size={17} />
                </button>
              ))}
            </div>
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                이전
              </Button>
              <span>
                {page + 1} 페이지 · {activity.total}개
              </span>
              <Button
                variant="secondary"
                disabled={(page + 1) * activity.size >= activity.total}
                onClick={() => setPage(page + 1)}
              >
                다음
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            illustration={kind === "posts" ? "community" : "documents"}
            title={
              kind === "posts"
                ? "아직 작성한 글이 없어요"
                : "아직 등록한 자료가 없어요"
            }
            description="모임에서 남긴 기록이 여기에 모여요."
          />
        )}
      </Card>
    </div>
  );
}
