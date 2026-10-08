// Isolated UI/API fixtures: never writes to production or sends authentication mail.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const app = "http://localhost:3112";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3112"],
  { stdio: "pipe" },
);
server.stdout.on("data", () => {});
server.stderr.on("data", () => {});
let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const group = "11111111-1111-4111-8111-111111111111",
  other = "44444444-4444-4444-8444-444444444444",
  user = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333";
const stamp = "2026-10-08T01:00:00Z";
const author = { id: user, display_name: "모아 QA", avatar_url: null };
const profile = {
  ...author,
  email: "qa@example.test",
  created_at: stamp,
  updated_at: stamp,
};
const team = {
  id: group,
  name: "QA 북클럽",
  timezone: "Asia/Seoul",
  role: "owner",
  created_at: stamp,
  updated_at: stamp,
};
let title = "캐시 QA 글";
let removed = false;
const post = () => ({
  id,
  group_id: group,
  author_id: user,
  author,
  title,
  body: "테스트 내용",
  kind: "general",
  created_at: stamp,
  updated_at: stamp,
});
const doc = {
  id,
  group_id: group,
  author_id: user,
  author,
  title: "QA 메모",
  kind: "memo",
  text_content: "메모 본문",
  status: "ready",
  version: 1,
  created_at: stamp,
  updated_at: stamp,
};
const event = {
  id,
  group_id: group,
  author_id: user,
  author,
  title: "QA 일정",
  description: "일정 설명",
  location: "온라인",
  starts_at: "2026-10-24T05:00:00Z",
  ends_at: "2026-10-24T07:00:00Z",
  created_at: stamp,
  updated_at: stamp,
};
const paged = (items, total = items.length) => ({
  items,
  page: 0,
  size: 20,
  total,
});
const root = "/tmp/moadam-performance-qa";
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    await sleep(250);
    if (i === 79) throw Error("Server start failed");
  }
  browser = await chromium.launch({ headless: true });
  await fs.mkdir(root, { recursive: true });
  const anon = await browser.newContext();
  let anonRequests = 0;
  await anon.route("**/api/proxy/**", (r) => {
    anonRequests++;
    return r.fulfill({ status: 401, body: "{}" });
  });
  for (const path of [
    "/",
    "/documents",
    "/community",
    "/events",
    "/members",
    "/mypage",
    "/settings",
    "/chat",
  ]) {
    const p = await anon.newPage();
    await p.goto(app + path, { waitUntil: "networkidle" });
    await p.locator(".auth-layout").waitFor();
    await p.close();
  }
  assert.equal(anonRequests, 0);
  await anon.close();
  console.log("PASS: anonymous access, zero protected requests across 8 pages");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "access", value: "qa-fixture", url: app, httpOnly: true },
  ]);
  const calls = [];
  let failed = false;
  let messageDelays = true;
  await context.route("**/api/auth", async (r) =>
    r.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await context.route("**/api/proxy/**", async (r) => {
    const u = new URL(r.request().url()),
      path = u.pathname.replace("/api/proxy/", ""),
      method = r.request().method();
    calls.push({ path, query: u.search, method, time: Date.now() });
    await sleep(path === "me" ? 450 : 180);
    if (failed && path.endsWith("/documents"))
      return r.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"message":"QA 서버 연결 실패"}',
      });
    let data;
    if (path === "me") data = profile;
    else if (path === "groups")
      data = paged([team, { ...team, id: other, name: "다른 QA 모임" }]);
    else if (path === "me/activity")
      data = paged([
        {
          id,
          group_id: group,
          group_name: team.name,
          title,
          kind: "general",
          created_at: stamp,
        },
      ]);
    else if (path.endsWith("/posts") && method === "GET")
      data = paged(
        removed
          ? []
          : [
              {
                ...post(),
                ...(path.startsWith("groups/" + other)
                  ? { group_id: other, title: "다른 모임 QA 글" }
                  : {}),
              },
            ],
      );
    else if (path.endsWith("/posts/" + id) && method === "PATCH") {
      title = JSON.parse(r.request().postData()).title;
      data = post();
    } else if (path.endsWith("/posts/" + id) && method === "DELETE") {
      removed = true;
      data = { deleted: true };
    } else if (path.endsWith("/posts/" + id)) data = post();
    else if (path.endsWith("/comments")) data = paged([]);
    else if (path.endsWith("/documents")) data = paged([doc]);
    else if (path.endsWith("/documents/" + id)) data = doc;
    else if (path.endsWith("/events")) data = paged([event]);
    else if (path.endsWith("/members"))
      data = paged([
        {
          group_id: group,
          user_id: user,
          profile: author,
          role: "owner",
          created_at: stamp,
        },
      ]);
    else if (path.endsWith("/invites")) data = paged([]);
    else if (path.endsWith("/chat/sessions"))
      data = paged([
        { id: "first", title: "첫 대화", created_at: stamp },
        { id: "second", title: "두 번째 대화", created_at: stamp },
      ]);
    else if (path.endsWith("/messages")) {
      if (messageDelays) await sleep(path.includes("/first/") ? 700 : 50);
      data = paged([
        {
          id: path.includes("/first/") ? "msg1" : "msg2",
          role: "assistant",
          content: path.includes("/first/") ? "첫 대화 답변" : "최신 대화 답변",
          citations: [],
          grounded: true,
          created_at: stamp,
        },
      ]);
    } else data = paged([]);
    try {
      await r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-boot-skeleton").waitFor();
  await page.screenshot({ path: root + "/boot-desktop.png" });
  await page.locator("#workspace-main").waitFor();
  await page.getByText("캐시 QA 글", { exact: true }).waitFor();
  const nav = async (name, ready) => {
    console.log("QA navigation:", name);
    await page
      .locator(".sidebar")
      .getByRole("link", { name, exact: true })
      .click();
    if (ready) await page.locator(ready).waitFor();
  };
  await nav("자료 보관함", ".document-row");
  await nav("커뮤니티", ".post-card");
  const count = (path) =>
    calls.filter((c) => c.path.endsWith(path) && c.method === "GET").length;
  const beforeDocs = count("/documents");
  const start = Date.now();
  await nav("자료 보관함", ".document-row");
  const cachedMs = Date.now() - start;
  assert.equal(count("/documents"), beforeDocs);
  await nav("커뮤니티", ".post-card");
  await page.getByRole("button", { name: "캐시 QA 글", exact: true }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목", { exact: true }).fill("갱신된 QA 글");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await page
    .getByRole("button", { name: "갱신된 QA 글", exact: true })
    .waitFor();
  assert(count("/posts") >= 3);
  await nav("멤버 · 초대", ".member-row");
  const memberCall = calls.findLast((c) => c.path.endsWith("/members"));
  const inviteCall = calls.findLast((c) => c.path.endsWith("/invites"));
  assert(Math.abs(memberCall.time - inviteCall.time) < 100);
  await nav("마이페이지", ".profile-card");
  await page.locator(".my-activity-item").waitFor();
  const activityCalls = count("me/activity");
  await nav("모임 설정", "form");
  await nav("마이페이지", ".my-activity-item");
  assert.equal(count("me/activity"), activityCalls);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "모아AI", exact: false })
    .click();
  await page
    .getByRole("dialog")
    .locator(".conversation-list button")
    .first()
    .waitFor();
  await page.getByRole("button", { name: /첫 대화/ }).click();
  await page.locator('[aria-label="대화를 불러오고 있어요"]').waitFor();
  await page.getByRole("button", { name: /두 번째 대화/ }).click();
  await page.getByText("최신 대화 답변", { exact: true }).waitFor();
  await sleep(800);
  assert.equal(
    await page.getByText("첫 대화 답변", { exact: true }).count(),
    0,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  // Expiration/error recovery via browser clock, with fixture API failure.
  failed = true;
  await page.goto(app + "/documents", { waitUntil: "networkidle" });
  await page
    .locator(".error")
    .filter({ hasText: "QA 서버 연결 실패" })
    .waitFor();
  failed = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await page.locator(".document-row").waitFor();
  // Second group must request its own resources and cannot display cached first group content.
  await page.getByRole("button", { name: "현재 모임", exact: false }).click();
  await page
    .getByRole("option", { name: "다른 QA 모임", exact: false })
    .click();
  await page.locator(".knowledge-hero").waitFor();
  await page
    .getByRole("button", { name: "다른 모임 QA 글", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "갱신된 QA 글", exact: true })
      .count(),
    0,
  );
  assert(calls.some((c) => c.path.startsWith("groups/" + other + "/posts")));
  await page.getByRole("button", { name: "로그아웃", exact: false }).click();
  await page.locator(".auth-layout").waitFor();
  const afterLogout = calls.length;
  await sleep(250);
  assert.equal(calls.length, afterLogout);
  await page.getByLabel("이메일", { exact: true }).fill("qa@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill("password!");
  await page
    .locator("form")
    .getByRole("button", { name: "로그인하기", exact: true })
    .click();
  await page.locator(".knowledge-hero").waitFor();
  await page
    .getByRole("button", { name: "다른 모임 QA 글", exact: true })
    .waitFor();
  assert(calls.slice(afterLogout).some((c) => c.path === "me"));
  assert(calls.slice(afterLogout).some((c) => c.path.endsWith("/posts")));
  await page.getByRole("button", { name: "현재 모임", exact: false }).click();
  await page.getByRole("option", { name: "QA 북클럽", exact: true }).click();
  await page
    .getByRole("button", { name: "갱신된 QA 글", exact: true })
    .waitFor();
  await nav("커뮤니티", ".post-card");
  await page.getByRole("button", { name: "갱신된 QA 글", exact: true }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "삭제 확인" })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await page.locator(".empty").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "갱신된 QA 글", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  await context.close();
  const expired = await browser.newContext();
  await expired.addCookies([
    { name: "access", value: "expired-qa", url: app, httpOnly: true },
  ]);
  const expiredCalls = [];
  await expired.route("**/api/proxy/**", (r) => {
    expiredCalls.push(new URL(r.request().url()).pathname);
    return r.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"message":"세션 만료"}',
    });
  });
  const ep = await expired.newPage();
  await ep.goto(app, { waitUntil: "networkidle" });
  await ep.locator(".auth-layout").waitFor();
  assert.deepEqual(expiredCalls, ["/api/proxy/me"]);
  await expired.close();
  // Mobile bootstrap and reduced-motion accessibility.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await mobile.addCookies([
    { name: "access", value: "qa-mobile", url: app, httpOnly: true },
  ]);
  await mobile.route("**/api/proxy/**", async (r) => {
    await sleep(800);
    const path = new URL(r.request().url()).pathname;
    await r.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        path.endsWith("/me")
          ? profile
          : path.endsWith("/groups")
            ? paged([team])
            : paged([]),
      ),
    });
  });
  const mp = await mobile.newPage();
  await mp.goto(app, { waitUntil: "domcontentloaded" });
  await mp.locator(".workspace-boot-skeleton").waitFor();
  assert.equal(
    await mp
      .locator(".skeleton-shimmer")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  assert(
    await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await mp.screenshot({ path: root + "/boot-mobile.png" });
  await mp.locator(".knowledge-hero").waitFor();
  await mobile.close();
  console.log(
    JSON.stringify({
      status: "PASS",
      cachedNavigationMs: cachedMs,
      tests: [
        "bootstrap skeleton",
        "cached navigation without duplicate GET",
        "edit invalidation",
        "parallel members/invites",
        "activity cache",
        "conversation race",
        "503 retry",
        "group isolation",
        "logout and new login with fresh data",
        "delete invalidation",
        "expired session stops requests",
        "mobile reduced motion",
      ],
      screenshots: root,
    }),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
