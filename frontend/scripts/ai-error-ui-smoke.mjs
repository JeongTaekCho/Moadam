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
const liveReport = process.env.MOADAM_MARKDOWN_REPORT
  ? JSON.parse(await fs.readFile(process.env.MOADAM_MARKDOWN_REPORT, "utf8"))
  : null;
const liveCases = liveReport
  ? [
      ...liveReport.cases,
      ...(liveReport.streaming
        ? [
            {
              kind: "streaming_general",
              question: "광합성이 무엇인지 쉬운 말로 설명해줘.",
              ...liveReport.streaming,
              strong_count: 1,
            },
          ]
        : []),
    ]
  : [];
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
const markdownAnswer = [
  "연결을 복구한 답변이에요.",
  "",
  "## 확인 순서",
  "1. **자료** 확인",
  "2. `설정` 확인",
  "",
  "- 문단 간격 확인",
  "- 코드 예시 확인",
  "",
  "```python",
  "def hello():",
  '    print("안녕하세요")',
  "",
  `    # ${"긴 코드 ".repeat(35)}`,
  "```",
  "",
  '<script>alert("실행 금지")</script>',
].join("\n");
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
    let used = 116000;
    let legacyUsage = true;
    const quota = () => ({
      limit_tokens: 120000,
      used_tokens: used,
      reserved_tokens: 0,
      remaining_tokens: 120000 - used,
      available_tokens: 120000 - used,
      used_percent: Math.round((used / 1200) * 10) / 10,
      resets_at: new Date(Date.now() + 86400000).toISOString(),
    });
    await context.route("**/api/proxy/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(
          "/api/proxy/",
          "",
        ),
        method = route.request().method();
      if ((path === "groups" || path === "invites/join") && method === "POST") {
        await route.fulfill({
          status: 409,
          json: {
            code: "GROUP_LIMIT_REACHED",
            message: "모임은 최대 3개까지 이용할 수 있어요.",
            requestId: "quota-qa",
          },
        });
        return;
      }
      let data;
      if (path.endsWith("/messages/stream")) {
        attempts++;
        const sample = attempts > 2 ? liveCases[attempts - 3] : null;
        const reply = sample?.answer ?? markdownAnswer;
        if (attempts > 1) used += sample?.tokens ?? 4000;
        const grounded =
          sample?.grounded ?? sample?.kind.startsWith("document") ?? false;
        const citations =
          sample?.citations ??
          (grounded
            ? [
                {
                  document_id: session,
                  chunk_id: session,
                  title: "가상 모임 안내",
                  page: 1,
                },
              ]
            : []);
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
                { type: "delta", text: sample?.delta_answer ?? reply },
                {
                  type: "done",
                  user: {
                    id: `user-message-${attempts}`,
                    group_id: group,
                    session_id: session,
                    role: "user",
                    content: route.request().postDataJSON().question,
                    citations: [],
                    grounded: false,
                    created_at: stamp,
                  },
                  assistant: {
                    id: `assistant-message-${attempts}`,
                    group_id: group,
                    session_id: session,
                    role: "assistant",
                    content: reply,
                    citations,
                    grounded,
                    created_at: stamp,
                  },
                },
              ];
        await route.fulfill({
          contentType: "application/x-ndjson",
          body: [{ type: "usage", usage: quota() }, ...events]
            .map((event) => JSON.stringify(event) + "\n")
            .join(""),
        });
        return;
      }
      if (path === "me/ai-usage")
        data = legacyUsage
          ? { limit: 30, used: 1, remaining: 29, resets_at: quota().resets_at }
          : quota();
      else if (path.endsWith("/attendance")) data = [];
      else if (/\/events\/[^/]+$/.test(path) || /\/posts\/[^/]+$/.test(path)) {
        const id = path.split("/").at(-1);
        const source = liveCases
          .flatMap((sample) => sample.citations ?? [])
          .find((source) => source.source_id === id);
        data = {
          id,
          group_id: group,
          author_id: user,
          author: {
            id: user,
            display_name: profile.display_name,
            avatar_url: null,
          },
          title: source?.title ?? "참조 원문",
          description: "노트 준비",
          location: "가상 회의실",
          starts_at: "2026-10-14T00:00:00Z",
          ends_at: "2026-10-14T02:00:00Z",
          body: "회비는 5천원",
          kind: "notice",
          created_at: stamp,
          updated_at: stamp,
        };
      } else if (path === "me") data = profile;
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
    await dialog
      .getByText("사용량을 확인하지 못했어요", { exact: true })
      .waitFor();
    assert.equal(await dialog.locator(".chat-usage-count strong").count(), 0);
    assert(
      await dialog
        .getByRole("button", { name: "질문 보내기", exact: true })
        .isDisabled(),
    );
    legacyUsage = false;
    await dialog
      .getByRole("button", { name: "다시 확인", exact: true })
      .click();
    await dialog.getByText("3.3%", { exact: true }).waitFor();
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
    const markdown = dialog.locator(".message.assistant .markdown");
    await markdown
      .locator("h2")
      .getByText("확인 순서", { exact: true })
      .waitFor();
    await dialog.locator('.message.assistant[aria-busy="false"]').waitFor();
    assert.equal(await markdown.locator("ol > li").count(), 2);
    assert.equal(await markdown.locator("ul > li").count(), 2);
    assert.equal(await markdown.locator("strong").innerText(), "자료");
    assert.equal(
      await markdown.locator("pre code").textContent(),
      markdownAnswer.split("```python\n")[1].split("\n```")[0],
    );
    assert.equal(await markdown.locator("script").count(), 0);
    assert.equal(
      await markdown
        .locator("ol")
        .evaluate((node) => getComputedStyle(node).listStyleType),
      "decimal",
    );
    assert(
      await markdown
        .locator("pre")
        .evaluate((node) => node.scrollWidth > node.clientWidth),
    );
    assert(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    );
    assert.equal(await dialog.getByRole("alert").count(), 0);
    await page.waitForFunction(
      () => document.querySelector("#chat-question")?.value === "",
    );
    assert.equal(await input.inputValue(), "");
    assert.equal(attempts, 2);
    await dialog.getByText("0%", { exact: true }).waitFor();
    await input.fill("한도 이후 질문");
    assert(
      await dialog
        .getByRole("button", { name: "질문 보내기", exact: true })
        .isDisabled(),
    );
    assert.equal(attempts, 2);
    await dialog.getByText(/오늘의 사용량을 모두 사용했어요/).waitFor();
    await page.screenshot({
      path: `/tmp/moadam-ai-error-qa/quota-${width}.png`,
    });
    used = 0;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await dialog.getByText("100%", { exact: true }).waitFor();
    assert(
      await dialog
        .getByRole("button", { name: "질문 보내기", exact: true })
        .isEnabled(),
    );
    for (const sample of liveCases) {
      const previousCount = await dialog.locator(".message.assistant").count();
      await input.fill(sample.question);
      await dialog
        .getByRole("button", { name: "질문 보내기", exact: true })
        .click();
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll(".message.assistant").length > count,
        previousCount,
      );
      await page.waitForFunction(() => {
        const latest = [...document.querySelectorAll(".message.assistant")].at(
          -1,
        );
        return (
          latest?.getAttribute("aria-busy") === "false" &&
          document.querySelector("#chat-question")?.value === ""
        );
      });
      const answer = dialog.locator(".message.assistant .markdown").last();
      if (sample.strong_count > 0) {
        assert((await answer.locator("strong").count()) > 0, sample.kind);
        assert(
          await answer
            .locator("strong")
            .first()
            .evaluate(
              (node) => Number(getComputedStyle(node).fontWeight) >= 600,
            ),
        );
      }
      assert((await answer.locator("p, li, pre, h2, h3").count()) >= 1);
      assert(!/\*\*/.test(await answer.innerText()), sample.kind);
      if (sample.kind === "streaming_general")
        assert((await answer.locator("p").count()) >= 2);
      if (sample.kind === "code")
        assert((await answer.locator("pre code").count()) > 0);
      assert(
        await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
        sample.kind,
      );
      await page.screenshot({
        path: `/tmp/moadam-ai-error-qa/live-${sample.kind}-${width}.png`,
      });
      console.log(
        `PASS: actual-model recorded answer ${sample.kind}, rendered strong/paragraphs/code ${width}`,
      );
      const groupSource = sample.citations?.find(
        (source) =>
          source.source_type === "event" || source.source_type === "notice",
      );
      if (groupSource) {
        await dialog
          .locator(".message.assistant")
          .last()
          .locator("button.citation")
          .filter({ hasText: groupSource.title })
          .click();
        await dialog.waitFor({ state: "hidden" });
        await page
          .getByRole("heading", { name: groupSource.title, exact: true })
          .waitFor();
        console.log(
          `PASS: ${groupSource.source_type} citation opens current source ${width}`,
        );
        await page
          .getByRole("button", { name: "모아AI 열기", exact: true })
          .click();
        await dialog.waitFor();
      }
    }
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    if (width === 390)
      await page
        .getByRole("button", { name: "모임 메뉴 열기", exact: true })
        .click();
    for (const kind of ["create", "join"]) {
      await page
        .getByRole("button", {
          name: kind === "create" ? "모임 만들기" : "초대 참여",
          exact: true,
        })
        .click();
      const editor = page.getByRole("dialog", {
        name: kind === "create" ? "모임 만들기" : "초대 참여",
        exact: true,
      });
      await editor
        .getByLabel(kind === "create" ? "모임 이름" : "초대 코드", {
          exact: true,
        })
        .fill("quota-qa");
      await editor.getByRole("button", { name: "저장", exact: true }).click();
      const limit = page.getByRole("dialog", {
        name: "모임 이용 한도에 도달했어요",
        exact: true,
      });
      await limit
        .getByText(/더 이상 모임을 만들거나 참여할 수 없습니다/)
        .waitFor();
      assert.equal(await editor.count(), 0);
      await page.screenshot({
        path: `/tmp/moadam-ai-error-qa/group-limit-${kind}-${width}.png`,
      });
      await limit.getByRole("button", { name: "확인", exact: true }).click();
    }
    assert.deepEqual(errors, []);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await context.close();
    console.log(
      `PASS: visible in-dialog AI failure, preserved retry draft and recovered streaming answer, create/join limit dialogs ${width}`,
    );
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
