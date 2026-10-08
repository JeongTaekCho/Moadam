// Isolated HTTP checks using a fake Auth server; no real Google/Supabase users.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const app = "http://localhost:3100";
let expectedVerifier = "";
let exchangeCount = 0;
const mock = createServer(async (request, response) => {
  const endpoint = new URL(request.url, "http://mock.test");
  if (endpoint.pathname === "/auth/v1/signup") {
    assert.equal(
      endpoint.searchParams.get("redirect_to"),
      "https://moadam.vercel.app/",
    );
    let input = "";
    for await (const chunk of request) input += chunk;
    const { email } = JSON.parse(input);
    response.setHeader("Content-Type", "application/json");
    if (email === "duplicate-error@example.test") {
      response
        .writeHead(422)
        .end(
          JSON.stringify({
            error_code: "user_already_exists",
            msg: "User already registered",
          }),
        );
      return;
    }
    if (email === "duplicate-hidden@example.test") {
      response.end(JSON.stringify({ id: "obfuscated-user", identities: [] }));
      return;
    }
    response.end(
      JSON.stringify({
        id: "pending-email-user",
        identities: [{ provider: "email" }],
      }),
    );
    return;
  }
  if (request.url !== "/auth/v1/token?grant_type=pkce") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  const input = JSON.parse(body);
  exchangeCount++;
  response.setHeader("Content-Type", "application/json");
  if (
    input.code_verifier !== expectedVerifier ||
    input.auth_code !== "mock-valid-code"
  ) {
    response
      .writeHead(400)
      .end(
        JSON.stringify({ msg: "Invalid grant", error_code: "invalid_grant" }),
      );
    return;
  }
  const jwt = [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000001",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "mock-signature",
  ].join(".");
  response.end(
    JSON.stringify({
      access_token: jwt,
      refresh_token: "mock-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "mock@example.test",
        app_metadata: { provider: "google" },
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    }),
  );
});
await new Promise((resolve) => mock.listen(9101, "127.0.0.1", resolve));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3100"],
  {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      SUPABASE_URL: "http://127.0.0.1:9101",
      SUPABASE_PUBLISHABLE_KEY: "mock-publishable-key",
      NODE_ENV: "production",
      AUTH_SITE_URL: "https://moadam.vercel.app",
    },
  },
);
let serverErrors = "";
server.stderr.on("data", (chunk) => {
  serverErrors += chunk;
});
const get = (path, cookie) =>
  fetch(app + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
const post = (origin) =>
  fetch(app + "/api/auth/google", { method: "POST", headers: { origin } });
try {
  for (let i = 0; i < 50; i++) {
    try {
      await get("/");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal((await post("https://other.example")).status, 403);
  console.log("PASS: cross-origin OAuth start rejected");
  const start = await post(app);
  assert.equal(start.status, 200);
  const url = new URL((await start.json()).url);
  assert.equal(url.origin, "http://127.0.0.1:9101");
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(url.searchParams.get("redirect_to"), app + "/login/callback");
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  const verifierCookie = start.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("moadam-oauth-verifier="));
  assert.ok(verifierCookie);
  assert.match(verifierCookie, /HttpOnly/i);
  assert.match(verifierCookie, /Secure/i);
  assert.match(verifierCookie, /SameSite=lax/i);
  const cookie = verifierCookie.split(";")[0];
  expectedVerifier = JSON.parse(
    decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)),
  );
  assert.equal(
    createHash("sha256").update(expectedVerifier).digest("base64url"),
    url.searchParams.get("code_challenge"),
  );
  console.log(
    "PASS: Google URL, exact callback, PKCE S256 and secure verifier cookie",
  );
  const expired = await get("/login/callback?code=mock-valid-code");
  assert.match(expired.headers.get("location"), /auth_error=google_expired/);
  assert.equal(exchangeCount, 0);
  const cancelled = await get("/login/callback?error=access_denied", cookie);
  assert.match(
    cancelled.headers.get("location"),
    /auth_error=google_cancelled/,
  );
  assert.ok(
    cancelled.headers
      .getSetCookie()
      .some((cookie) => /moadam-oauth-verifier=.*Max-Age=0/.test(cookie)),
  );
  console.log(
    "PASS: missing verifier and cancelled login handled without exchange",
  );
  const rejected = await get("/login/callback?code=wrong-code", cookie);
  assert.match(rejected.headers.get("location"), /auth_error=google_failed/);
  assert.ok(
    !rejected.headers
      .getSetCookie()
      .some((cookie) => cookie.startsWith("access=")),
  );
  console.log("PASS: invalid code creates no login session");
  const success = await get(
    "/login/callback?code=mock-valid-code&next=https://other.example",
    cookie,
  );
  assert.equal(success.status, 307);
  assert.equal(success.headers.get("location"), app + "/");
  const cookies = success.headers.getSetCookie();
  for (const name of ["access", "refresh"]) {
    const entry = cookies.find((cookie) => cookie.startsWith(name + "="));
    assert.ok(entry);
    assert.match(entry, /HttpOnly/i);
    assert.match(entry, /Secure/i);
    assert.match(entry, /SameSite=lax/i);
  }
  assert.ok(
    cookies.some((cookie) => /moadam-oauth-verifier=.*Max-Age=0/.test(cookie)),
  );
  assert.equal(success.headers.get("cache-control"), "no-store");
  console.log(
    "PASS: successful exchange sets BFF cookies, clears verifier, blocks external redirect",
  );
  const signup = await fetch(app + "/api/auth", {
    method: "POST",
    headers: { origin: app, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "signup",
      email: "preview@example.test",
      password: "mock-password-123",
    }),
  });
  assert.equal(signup.status, 200);
  assert.equal((await signup.json()).confirmationRequired, true);
  assert.equal(signup.headers.getSetCookie().length, 0);
  console.log(
    "PASS: email signup uses frontend redirect and awaits confirmation without session cookies",
  );
  for (const email of [
    "duplicate-error@example.test",
    "duplicate-hidden@example.test",
  ]) {
    const duplicate = await fetch(app + "/api/auth", {
      method: "POST",
      headers: { origin: app, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "signup",
        email,
        password: "mock-password-123",
      }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal(
      (await duplicate.json()).message,
      "이미 가입된 이메일입니다. 로그인해 주세요.",
    );
    assert.equal(duplicate.headers.getSetCookie().length, 0);
  }
  console.log(
    "PASS: explicit and obfuscated duplicate signup return conflict without session cookies",
  );
} catch (error) {
  if (serverErrors) console.error(serverErrors);
  throw error;
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => mock.close(resolve));
}
