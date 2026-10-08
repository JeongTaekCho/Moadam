import { NextRequest, NextResponse } from "next/server";
import { failure } from "@/shared/lib/server";
import { createOAuthClient } from "@/shared/lib/supabase-oauth";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return failure(403, "잘못된 요청입니다");
  try {
    const response = NextResponse.json({ url: "" });
    const supabase = createOAuthClient(request, response);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(
          "/login/callback",
          request.nextUrl.origin,
        ).toString(),
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url)
      return failure(
        503,
        "Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    // Preserve the PKCE Set-Cookie generated on the response.
    return new NextResponse(JSON.stringify({ url: data.url }), {
      headers: {
        ...Object.fromEntries(response.headers),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return failure(
      503,
      "Google 로그인을 시작하지 못했습니다. Supabase 설정을 확인해 주세요.",
    );
  }
}
