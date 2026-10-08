import type { View } from "@/shared/config/navigation";

export function ContentSkeleton({
  view = "홈",
  label = "화면을 불러오고 있어요",
}: {
  view?: View;
  label?: string;
}) {
  return (
    <div
      className={`content-skeleton skeleton-${view === "홈" ? "home" : view === "일정" ? "calendar" : "list"}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="skeleton-heading skeleton-shimmer" aria-hidden="true" />
      <div className="skeleton-cards" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div className="skeleton-card" key={i}>
            <div className="skeleton-line skeleton-shimmer" />
            <div className="skeleton-line skeleton-shimmer" />
            <div className="skeleton-line skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <main
      className="workspace-boot-skeleton"
      role="status"
      aria-label="로그인 상태와 모임을 확인하고 있어요"
      aria-busy="true"
    >
      <span className="sr-only">로그인 상태와 모임을 확인하고 있어요</span>
      <aside aria-hidden="true">
        <div className="skeleton-heading skeleton-shimmer" />
        <div className="skeleton-group skeleton-shimmer" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-nav skeleton-shimmer" />
        ))}
      </aside>
      <section>
        <div className="skeleton-topbar skeleton-shimmer" aria-hidden="true" />
        <ContentSkeleton />
      </section>
    </main>
  );
}
