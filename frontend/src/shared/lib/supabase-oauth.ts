import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "./auth-session";

export const oauthVerifierCookie = "moadam-oauth-verifier";
const storageKey = "moadam-oauth";
const verifierKey = `${storageKey}-code-verifier`;

// The existing BFF owns session cookies. The SDK uses this adapter only for
// the pending PKCE verifier; full sessions stay in per-request memory.
export function createOAuthClient(
  request: NextRequest,
  response: NextResponse,
) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경 설정이 필요합니다");
  const storage = new Map<string, string>();
  const verifier = request.cookies.get(oauthVerifierCookie)?.value;
  if (verifier && verifier.length <= 1024) storage.set(verifierKey, verifier);
  return createClient(url, key, {
    auth: {
      storageKey,
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
          if (key === verifierKey)
            response.cookies.set(oauthVerifierCookie, value, {
              ...authCookieOptions,
              maxAge: 600,
            });
        },
        removeItem: (key) => {
          storage.delete(key);
          if (key === verifierKey)
            response.cookies.set(oauthVerifierCookie, "", {
              ...authCookieOptions,
              maxAge: 0,
            });
        },
      },
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }),
    },
  });
}
