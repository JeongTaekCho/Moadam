import { failure, limitedBody } from "@/shared/lib/server";
import { NextRequest, NextResponse } from "next/server";
async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (req.method !== "GET" && req.headers.get("origin") !== req.nextUrl.origin)
    return failure(403, "잘못된 요청입니다");
  const { path } = await params;
  if (!path.every((p) => /^[a-zA-Z0-9_-]+$/.test(p)))
    return failure(400, "잘못된 경로입니다");
  let token = req.cookies.get("access")?.value;
  let refreshed:
    | { access_token: string; refresh_token: string; expires_in: number }
    | undefined;
  try {
    if (!token && req.cookies.get("refresh")?.value) {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh_token: req.cookies.get("refresh")?.value,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.ok) {
        refreshed = await response.json();
        token = refreshed?.access_token;
      }
    }
    if (!token)
      return failure(401, "세션이 만료되었습니다. 다시 로그인해 주세요.");
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://localhost:8080"}/api/v1/${path.join("/")}${req.nextUrl.search}`,
      {
        method: req.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : await limitedBody(req),
        cache: "no-store",
        signal: AbortSignal.timeout(100000),
      },
    );
    const res = new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
    if (refreshed) {
      const opts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };
      res.cookies.set("access", refreshed.access_token, {
        ...opts,
        maxAge: refreshed.expires_in,
      });
      res.cookies.set("refresh", refreshed.refresh_token, {
        ...opts,
        maxAge: 604800,
      });
    }
    return res;
  } catch (e) {
    if (e instanceof RangeError) return failure(413, "요청 크기가 너무 큽니다");
    return failure(
      503,
      "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
export {
  proxy as DELETE,
  proxy as GET,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
