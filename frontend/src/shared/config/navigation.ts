export type View =
  | "홈"
  | "커뮤니티"
  | "일정"
  | "자료"
  | "챗봇"
  | "멤버"
  | "설정"
  | "마이페이지";
export const viewPaths: Record<View, string> = {
  홈: "/",
  커뮤니티: "/community",
  일정: "/events",
  자료: "/documents",
  챗봇: "/chat",
  멤버: "/members",
  설정: "/settings",
  마이페이지: "/mypage",
};
export function detailFromPath(
  path: string,
):
  | { view: "커뮤니티" | "일정"; resource: "posts" | "events"; id: string }
  | undefined {
  const match =
    /^\/(community|events)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(
      path,
    );
  if (!match) return;
  return {
    view: match[1] === "community" ? "커뮤니티" : "일정",
    resource: match[1] === "community" ? "posts" : "events",
    id: match[2],
  };
}
export function viewFromPath(path: string): View | undefined {
  return (
    detailFromPath(path)?.view ??
    (Object.entries(viewPaths) as [View, string][]).find(
      ([, url]) => url === path,
    )?.[0]
  );
}
export function navigateWorkspace(
  view: View,
  group: string,
  replace = false,
  detailId?: string,
) {
  const url =
    viewPaths[view] +
    (detailId ? "/" + encodeURIComponent(detailId) : "") +
    (group ? "?group=" + encodeURIComponent(group) : "");
  if (window.location.pathname + window.location.search === url) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  window.dispatchEvent(new Event("workspace:navigate"));
}

export function subscribeWorkspacePath(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("workspace:navigate", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("workspace:navigate", listener);
  };
}
