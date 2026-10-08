"use client";
import { authenticate, signInWithGoogle } from "@/features/auth";
import { values } from "@/shared/lib/form";
import {
  BrandLogo,
  Button,
  ErrorState,
  Icon,
  Tabs,
  TextField,
  Toast,
  MoaAiIcon,
  PageIllustration,
} from "@/shared/ui";
import type { WorkspaceModel } from "../model/use-workspace";
export function AuthScreen({ model: m }: { model: WorkspaceModel }) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <BrandLogo />
        </div>
        <div className="auth-story-content">
          <PageIllustration variant="welcome" className="auth-welcome-art" />
          <p className="eyebrow">A SPACE FOR YOUR PEOPLE</p>
          <h1>
            함께 나눈 이야기,
            <br />
            우리만의 지식이 되다.
          </h1>
          <p>
            소중한 사람들과 나누는 소식부터
            <br />
            언제든 다시 꺼내볼 자료까지.
            <br />
            모임의 소중한 정보를 모아 담아요.
          </p>
          <div className="auth-preview" aria-label="서비스 이용 예시">
            <div className="row between">
              <span>
                <MoaAiIcon size={20} /> 모아AI와 함께하는 모임
              </span>
              <span className="preview-live">이용 예시</span>
            </div>
            <div className="preview-question">이번 모임 준비물, 뭐였죠?</div>
            <div className="preview-answer">
              함께 기록한 자료에서 찾아드릴게요.
              <div className="preview-source">
                <Icon name="file" size={15} /> 준비 안내.pdf · 출처와 함께
              </div>
            </div>
          </div>
          <div className="auth-features">
            <span>
              <Icon name="posts" size={17} />
              함께 나누는 이야기
            </span>
            <span>
              <Icon name="calendar" size={17} />
              다음 만남의 계획
            </span>
            <span>
              <Icon name="lock" size={17} />
              우리만의 안전한 공간
            </span>
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
            <PageIllustration variant="welcome" className="auth-mobile-art" />
          </span>
          <p className="eyebrow">WELCOME TO MOADAM</p>
          <h2>
            {m.authTab === "로그인"
              ? "다시 만나 반가워요"
              : "우리 모임의 공간을 시작해요"}
          </h2>
          <p className="muted">Google 계정 또는 이메일로 시작하세요.</p>
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
              const b = values(e);
              await m.run(async () => {
                const d = await authenticate(
                  b,
                  m.authTab === "로그인" ? "login" : "signup",
                );
                if (d.confirmationRequired)
                  m.notify(
                    "메일의 가입 확인 링크를 눌러 주세요. 확인 후 로그인할 수 있습니다.",
                  );
                else await m.loadGroups();
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
      <Toast message={m.toast} />
    </main>
  );
}
