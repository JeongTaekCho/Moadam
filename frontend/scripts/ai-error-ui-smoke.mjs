import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const app = "http://localhost:3115",
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3115"],
  { stdio: "ignore" },
);
let browser;
const group = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  session = "33333333-3333-4333-8333-333333333333",
  stamp = "2026-10-13T01:00:00Z";
const profile = {
  id: user,
  display_name: "모아 QA",
  avatar_url: null,
  email: "qa@example.test",
  created_at: stamp,
  updated_at: stamp,
};
const paged = (items) => ({ items, total: items.length, page: 0, size: 100 });
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    await sleep(200);
    if (i === 79) throw Error("Server failed");
  }
  browser = await chromium.launch({ headless: true });
  await fs.mkdir("/tmp/moadam-ai-error-qa", { recursive: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addCookies([
      { name: "access", value: "ai-error-fixture", url: app, httpOnly: true },
    ]);
    let attempts = 0;
    await context.route("**/api/proxy/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(
          "/api/proxy/",
          "",
        ),
        method = route.request().method();
      let data;
      if (path.endsWith("/messages/stream")) {
        attempts++;
        const events =
          attempts === 1
            ? [
                { type: "status", stage: "retrieving" },
                {
                  type: "error",
                  code: "AI_CONNECTION_FAILED",
                  message:
                    "AI 서비스에 연결할 수 없어요. 관리자에게 AI 연결 설정 확인을 요청해 주세요.",
                },
              ]
            : [
                { type: "delta", text: "연결을 복구한 답변이에요." },
                {
                  type: "done",
                  user: {
                    id: "user-message",
                    group_id: group,
                    session_id: session,
                    role: "user",
                    content: "모임 자료가 있나요?",
                    citations: [],
                    grounded: false,
                    created_at: stamp,
                  },
                  assistant: {
                    id: "assistant-message",
                    group_id: group,
                    session_id: session,
                    role: "assistant",
                    content: "연결을 복구한 답변이에요.",
                    citations: [],
                    grounded: false,
                    created_at: stamp,
                  },
                },
              ];
        await route.fulfill({
          contentType: "application/x-ndjson",
          body: events.map((event) => JSON.stringify(event) + "\n").join(""),
        });
        return;
      }
      if (path === "me") data = profile;
      else if (path === "groups")
        data = paged([
          {
            id: group,
            name: "QA 북클럽",
            role: "owner",
            timezone: "Asia/Seoul",
          },
        ]);
      else if (path.endsWith("/chat/sessions") && method === "POST")
        data = {
          id: session,
          group_id: group,
          user_id: user,
          title: "QA 대화",
          created_at: stamp,
          updated_at: stamp,
        };
      else data = paged([]);
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(app, { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "모아AI 열기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "모아AI", exact: true }),
      input = dialog.getByLabel("모임에 대해 모아AI에 질문하기", {
        exact: true,
      });
    await input.fill("모임 자료가 있나요?");
    await dialog
      .getByRole("button", { name: "질문 보내기", exact: true })
      .click();
    await dialog.getByRole("alert").waitFor();
    assert.equal(await input.inputValue(), "모임 자료가 있나요?");
    assert(await input.isEnabled());
    assert.equal(
      await dialog
        .getByRole("button", { name: "답변 중지", exact: true })
        .count(),
      0,
    );
    assert(
      await dialog
        .getByRole("alert")
        .getByText(/AI 서비스에 연결할 수 없어요/)
        .isVisible(),
    );
    await page.screenshot({
      path: `/tmp/moadam-ai-error-qa/error-${width}.png`,
    });
    await dialog
      .getByRole("button", { name: "질문 보내기", exact: true })
      .click();
    await dialog
      .getByText("연결을 복구한 답변이에요.", { exact: true })
      .waitFor();
    assert.equal(await dialog.getByRole("alert").count(), 0);
    await page.waitForFunction(
      () => document.querySelector("#chat-question")?.value === "",
    );
    assert.equal(await input.inputValue(), "");
    assert.equal(attempts, 2);
    assert.deepEqual(errors, []);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await context.close();
    console.log(
      `PASS: visible in-dialog AI failure, preserved retry draft and recovered streaming answer ${width}`,
    );
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
