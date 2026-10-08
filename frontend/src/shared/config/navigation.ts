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
export function viewFromPath(path: string): View | undefined {
  return (Object.entries(viewPaths) as [View, string][]).find(
    ([, url]) => url === path,
  )?.[0];
}
export function navigateWorkspace(view: View, group: string, replace = false) {
  const url =
    viewPaths[view] + (group ? "?group=" + encodeURIComponent(group) : "");
  if (window.location.pathname + window.location.search === url) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}
