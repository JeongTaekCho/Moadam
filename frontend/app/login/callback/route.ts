import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, setAuthSession } from "@/shared/lib/auth-session";
import {
  createOAuthClient,
  oauthVerifierCookie,
} from "@/shared/lib/supabase-oauth";

export async function GET(request: NextRequest) {
  const failed = (reason: string) => {
    const response = NextResponse.redirect(
      new URL(`/?auth_error=${reason}`, request.nextUrl.origin),
    );
    response.cookies.set(oauthVerifierCookie, "", {
      ...authCookieOptions,
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  if (request.nextUrl.searchParams.has("error"))
    return failed("google_cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (
    !code ||
    code.length > 4096 ||
    !request.cookies.get(oauthVerifierCookie)?.value
  )
    return failed("google_expired");
  try {
    const response = NextResponse.redirect(
      new URL("/", request.nextUrl.origin),
    );
    const supabase = createOAuthClient(request, response);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) return failed("google_failed");
    setAuthSession(response, data.session);
    response.cookies.set(oauthVerifierCookie, "", {
      ...authCookieOptions,
      maxAge: 0,
    });
    return response;
  } catch {
    return failed("google_failed");
  }
}
