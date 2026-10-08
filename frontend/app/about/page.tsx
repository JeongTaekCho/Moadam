import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo, PageIllustration } from "@/shared/ui";
import { siteDescription, siteOpenGraph } from "@/shared/config/site";
export const metadata: Metadata = {
  title: "모임의 이야기를 한곳에 모으는 공간",
  description: siteDescription,
  alternates: { canonical: "/about" },
  openGraph: {
    ...siteOpenGraph,
    title: "모아담 — 모임의 이야기를 한곳에",
    description: siteDescription,
    url: "/about",
  },
};
const features = [
  {
    scene: "community" as const,
    title: "함께 나누는 모임 커뮤니티",
    text: "공지와 질문, 모임의 소식을 게시글과 댓글로 나누세요. 우리 모임의 이야기를 한곳에서 이어갈 수 있어요.",
  },
  {
    scene: "documents" as const,
    title: "다시 꺼내볼 수 있는 자료 보관함",
    text: "메모와 PDF 자료를 모아 보관하세요. 모아AI에 질문하면 모임에 등록한 자료를 바탕으로 답변과 출처를 확인할 수 있어요.",
  },
  {
    scene: "calendar" as const,
    title: "다음 만남을 함께 준비하는 일정",
    text: "모임 일정과 장소를 공유하고 참석 여부를 확인하세요. 다음 만남에 필요한 정보를 멤버들과 함께 준비할 수 있어요.",
  },
];
export default function AboutPage() {
  return (
    <div className="service-about">
      <header className="service-about-nav">
        <BrandLogo />
        <Link href="/" className="button secondary">
          로그인·가입
        </Link>
      </header>
      <main>
        <section className="service-about-hero">
          <div>
            <h1>
              모임의 이야기를,
              <br />
              한곳에 모아.
            </h1>
            <p>
              이야기와 자료, 다음 만남의 일정까지.
              <br />
              모아담은 함께하는 사람들의 기록을 모으는
              <br />
              모임 커뮤니티 공간입니다.
            </p>
            <Link href="/" className="button primary">
              모아담 시작하기
            </Link>
          </div>
          <PageIllustration variant="welcome" className="service-about-art" />
        </section>
        <section
          className="service-about-features"
          aria-label="모아담 주요 기능"
        >
          {features.map((feature) => (
            <article key={feature.scene}>
              <PageIllustration variant={feature.scene} />
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </article>
          ))}
        </section>
        <section className="service-about-ai">
          <PageIllustration variant="assistant" />
          <div>
            <h2>우리 모임에 대해 궁금할 땐, 모아AI</h2>
            <p>
              “다음 모임 준비물은 뭐였죠?” 함께 기록한 자료를 바탕으로 질문해
              보세요. 답변은 빠르게 이어지고, 근거로 사용한 자료도 함께 볼 수
              있어요.
            </p>
            <p className="muted">AI 답변의 출처와 내용을 함께 확인해 주세요.</p>
          </div>
        </section>
        <section className="service-about-faq">
          <h2>모아담을 시작하기 전에</h2>
          <details>
            <summary>누가 모임 자료를 볼 수 있나요?</summary>
            <p>
              모임 자료와 게시글은 해당 모임에 참여한 멤버에게만 공개됩니다.
              초대를 통해 모임에 참여하고 함께 기록을 나눌 수 있어요.
            </p>
          </details>
          <details>
            <summary>어떻게 가입하나요?</summary>
            <p>
              Google 계정 또는 이메일로 가입할 수 있어요. 이메일 가입 시 확인
              메일의 인증을 완료한 뒤 로그인하세요.
            </p>
          </details>
          <details>
            <summary>모아AI는 어떤 내용을 바탕으로 답하나요?</summary>
            <p>
              현재 모임에 등록한 자료를 검색해 답변합니다. 필요한 자료를 미리
              등록하고, 답변에 표시된 출처를 함께 확인하세요.
            </p>
          </details>
        </section>
      </main>
      <footer className="service-about-footer">
        <span>모아담 · 모임의 정보를 모아 담다</span>
        <Link href="/">모아담 시작하기</Link>
      </footer>
    </div>
  );
}
