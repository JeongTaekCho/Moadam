import "server-only";
import type { NextResponse } from "next/server";

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export function setAuthSession(
  response: NextResponse,
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  },
) {
  response.cookies.set("access", session.access_token, {
    ...authCookieOptions,
    maxAge: session.expires_in,
  });
  response.cookies.set("refresh", session.refresh_token, {
    ...authCookieOptions,
    maxAge: 604800,
  });
  response.headers.set("Cache-Control", "no-store");
}
