import { ApiError, clearApiSession } from "@/shared/api";
export async function authenticate(
  fields: Record<string, string>,
  action: "login" | "signup",
): Promise<{ confirmationRequired?: boolean }> {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, action }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      result.message || "로그인 요청을 처리하지 못했습니다",
    );
  if (action === "login") clearApiSession();
  return result;
}
export async function logout() {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
  if (!response.ok)
    throw new Error("로그아웃을 처리하지 못했습니다. 다시 시도해 주세요.");
  clearApiSession();
}

export async function signInWithGoogle() {
  const response = await fetch("/api/auth/google", { method: "POST" });
  const data = await response.json();
  if (!response.ok || typeof data.url !== "string")
    throw new Error(data.message || "Google 로그인을 시작하지 못했습니다");
  window.location.assign(data.url);
}
