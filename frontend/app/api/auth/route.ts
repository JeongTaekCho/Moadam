import { setAuthSession } from "@/shared/lib/auth-session";
import { failure, limitedBody } from "@/shared/lib/server";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return failure(403, "잘못된 요청입니다");
  let input: { email?: unknown; password?: unknown; action?: unknown };
  try {
    input = JSON.parse(await limitedBody(req, 16384));
  } catch (e) {
    return failure(
      e instanceof RangeError ? 413 : 400,
      "입력 값을 확인해 주세요",
    );
  }
  if (!input || typeof input !== "object")
    return failure(400, "입력 값을 확인해 주세요");
  const { email, password, action } = input;
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (action === "logout") {
    const token = req.cookies.get("access")?.value;
    if (url && key && token) {
      try {
        await fetch(`${url}/auth/v1/logout?scope=local`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* Local cookies are still removed when the auth service is offline. */
      }
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("access");
    res.cookies.delete("refresh");
    return res;
  }
  if (
    (action !== "login" && action !== "signup") ||
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    return failure(400, "이메일과 8자 이상의 비밀번호를 확인하세요");
  if (!url || !key) return failure(503, "Supabase 환경 설정이 필요합니다");
  try {
    const endpoint = new URL(
      `${url}/auth/v1/${action === "signup" ? "signup" : "token?grant_type=password"}`,
    );
    if (action === "signup")
      endpoint.searchParams.set(
        "redirect_to",
        new URL(
          "/",
          process.env.AUTH_SITE_URL ||
            (process.env.VERCEL_ENV === "production"
              ? "https://moadam.vercel.app"
              : req.nextUrl.origin),
        ).toString(),
      );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    const user = data.user ?? data;
    const duplicateSignup =
      action === "signup" &&
      (["user_already_exists", "email_exists"].includes(
        data.error_code ?? data.code,
      ) ||
        (!response.ok &&
          /user already registered/i.test(data.msg ?? data.message ?? "")) ||
        (response.ok &&
          Array.isArray(user.identities) &&
          user.identities.length === 0));
    if (duplicateSignup)
      return failure(409, "이미 가입된 이메일입니다. 로그인해 주세요.");
    if (!response.ok)
      return failure(
        response.status,
        "로그인/가입을 처리하지 못했습니다. 이메일과 비밀번호를 확인하세요.",
      );
    const res = NextResponse.json({
      ok: true,
      confirmationRequired: !data.access_token,
    });
    if (data.access_token) {
      setAuthSession(res, data);
    }
    return res;
  } catch (error) {
    const response = failure(503, "인증 서비스를 연결할 수 없습니다");
    const { requestId } = await response.clone().json();
    // Never log credentials, auth response bodies, or URLs containing keys.
    const cause = error instanceof Error ? error.cause : undefined;
    const causeCode =
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      typeof cause.code === "string" &&
      /^[A-Z0-9_]{1,64}$/.test(cause.code)
        ? cause.code
        : undefined;
    console.error("Auth request failed", {
      requestId,
      action,
      errorType: error instanceof Error ? error.name : "UnknownError",
      causeCode,
    });
    return response;
  }
}
