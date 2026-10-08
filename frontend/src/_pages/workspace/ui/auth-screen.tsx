"use client";
import { useEffect, useState } from "react";
import { authenticate, signInWithGoogle } from "@/features/auth";
import { ApiError } from "@/shared/api";
import { values } from "@/shared/lib/form";
import {
  BrandLogo,
  Button,
  ErrorState,
  Dialog,
  Icon,
  Tabs,
  TextField,
  Toast,
  MoaAiIcon,
  PageIllustration,
} from "@/shared/ui";
import type { WorkspaceModel } from "../model/use-workspace";
export function AuthScreen({ model: m }: { model: WorkspaceModel }) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [signupError, setSignupError] = useState("");
  useEffect(() => {
    if (!signupError) return;
    const timer = setTimeout(() => setSignupError(""), 5000);
    return () => clearTimeout(timer);
  }, [signupError]);
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <BrandLogo />
        </div>
        <div className="auth-story-content">
          <PageIllustration variant="welcome" className="auth-welcome-art" />
          <h1>
            모임의 이야기를,
            <br />
            한곳에 모아.
          </h1>
          <p>
            함께 나눈 이야기와 자료, 다음 만남의 일정까지.
            <br />
            우리 모임의 일상을 모아담에서 이어가세요.
          </p>
          <div
            className="auth-service-features"
            aria-label="모아담에서 할 수 있는 일"
          >
            <span>
              <Icon name="posts" size={20} />
              이야기 나누기
            </span>
            <span>
              <Icon name="file" size={20} />
              자료 모으기
            </span>
            <span>
              <Icon name="calendar" size={20} />
              함께 만날 일정
            </span>
          </div>
          <div className="auth-ai-note">
            <MoaAiIcon size={28} />
            <p>
              우리 모임에 대해 궁금할 땐,
              <br />
              모아AI에게 물어보세요.
            </p>
          </div>
        </div>
        <span className="auth-footnote">
          작은 기록이 모여, 오래 남는 연결이 됩니다.
        </span>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-box">
          <span className="auth-mobile-brand">
            <BrandLogo />
          </span>
          <h2>
            {m.authTab === "로그인"
              ? "다시 만나 반가워요"
              : "모아담과 함께 시작해요"}
          </h2>
          <p className="muted">이야기를 모으고, 함께하는 시간을 이어가세요.</p>
          <Button
            type="button"
            variant="secondary"
            className="google-signin"
            loading={m.busy}
            onClick={() => void m.run(signInWithGoogle)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
              />
            </svg>
            Google로 계속하기
          </Button>
          <div className="auth-divider">
            <span>또는 이메일로 계속하기</span>
          </div>
          <Tabs
            items={["로그인", "가입"]}
            value={m.authTab}
            onChange={m.setAuthTab}
          />
          {m.error && <ErrorState message={m.error} />}
          <form
            onSubmit={async (e) => {
              setSignupError("");
              const form = e.currentTarget;
              const b = values(e);
              const action = m.authTab === "로그인" ? "login" : "signup";
              await m.run(async () => {
                let d;
                try {
                  d = await authenticate(b, action);
                } catch (error) {
                  if (
                    action === "signup" &&
                    error instanceof ApiError &&
                    error.status === 409
                  ) {
                    setSignupError(error.message);
                    return;
                  }
                  throw error;
                }
                if (action === "signup") form.reset();
                if (d.confirmationRequired) {
                  setConfirmationOpen(true);
                } else await m.loadGroups();
              });
            }}
          >
            <TextField
              label="이메일"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <TextField
              label="비밀번호"
              name="password"
              type="password"
              placeholder="8자 이상 입력해 주세요"
              minLength={8}
              autoComplete={
                m.authTab === "로그인" ? "current-password" : "new-password"
              }
              required
            />
            <Button loading={m.busy}>
              {m.authTab === "로그인" ? "로그인하기" : "이메일로 가입하기"}
              <Icon name="arrow" size={17} />
            </Button>
          </form>
          <p className="auth-trust">
            <Icon name="lock" size={14} />
            모임 자료는 참여한 멤버에게만 공개됩니다.
          </p>
        </div>
      </section>
      {confirmationOpen && (
        <Dialog
          title="이메일 인증을 확인해 주세요"
          icon={<MoaAiIcon size={28} />}
          className="signup-confirmation-dialog"
          onClose={() => setConfirmationOpen(false)}
        >
          <p>가입한 이메일로 받은 확인 메일에서 인증 버튼을 눌러 주세요.</p>
          <p className="signup-mail-hint">
            메일이 보이지 않으면 스팸 메일함도 확인해 주세요.
          </p>
          <p className="muted">
            인증을 완료한 후 이메일과 비밀번호로 로그인할 수 있습니다.
          </p>
          <Button
            type="button"
            onClick={() => {
              setConfirmationOpen(false);
              m.setAuthTab("로그인");
            }}
          >
            확인
          </Button>
        </Dialog>
      )}
      <Toast
        message={signupError || m.toast}
        variant={signupError ? "error" : "default"}
      />
    </main>
  );
}
