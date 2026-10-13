import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const origin = "http://localhost:3118",
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3118"],
  { stdio: "ignore" },
);
let browser;
const group = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333",
  pdfId = "44444444-4444-4444-8444-444444444444";
const stamp = new Date().toISOString(),
  profile = {
    id: user,
    display_name: "QA",
    avatar_url: null,
    email: "qa@example.test",
    created_at: stamp,
    updated_at: stamp,
  };
const pageOf = (items) => ({ items, total: items.length, page: 0, size: 20 });
try {
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await sleep(200);
  }
  browser = await chromium.launch({ headless: true });
  await fs.mkdir("/tmp/moadam-document-jobs-qa", { recursive: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addCookies([
      { name: "access", value: "document-qa", url: origin, httpOnly: true },
    ]);
    let memo = {
      id,
      group_id: group,
      author_id: user,
      author: profile,
      title: "QA 메모",
      kind: "memo",
      text_content: "수정 전",
      status: "ready",
      error_code: null,
      version: 1,
      upload_completed: true,
      size_bytes: null,
      created_at: stamp,
      updated_at: stamp,
    };
    let pdf,
      polls = 0,
      indexCalls = 0,
      uploads = 0,
      resumes = 0,
      putAttempts = 0;
    await context.route("**/qa-storage/upload", (route) => {
      putAttempts++;
      return route.fulfill({ status: putAttempts === 1 ? 503 : 200, body: "" });
    });
    await context.route("**/api/proxy/**", async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname.replace("/api/proxy/", ""),
        method = route.request().method();
      let data;
      if (path === "me") data = profile;
      else if (path === "groups")
        data = pageOf([
          {
            id: group,
            name: "QA 자료 모임",
            timezone: "Asia/Seoul",
            role: "owner",
          },
        ]);
      else if (path.endsWith("/documents/uploads")) {
        uploads++;
        pdf = {
          ...memo,
          id: pdfId,
          title: "QA PDF",
          kind: "pdf",
          text_content: null,
          status: "pending",
          upload_completed: false,
        };
        data = {
          document: pdf,
          upload_url: origin + "/qa-storage/upload",
          expires_in: 7200,
        };
      } else if (path.endsWith("/upload-url")) {
        resumes++;
        data = {
          document: pdf,
          upload_url: origin + "/qa-storage/upload",
          expires_in: 7200,
        };
      } else if (path.endsWith("/complete")) {
        pdf = {
          ...pdf,
          upload_completed: true,
          status: "failed",
          error_code: "NO_TEXT_OCR_UNSUPPORTED",
        };
        data = pdf;
      } else if (path.endsWith("/index")) {
        indexCalls++;
        memo = { ...memo, status: "pending", error_code: null };
        data = memo;
      } else if (path.endsWith("/documents/" + pdfId)) data = pdf;
      else if (path.endsWith("/documents/" + id)) {
        if (method === "PATCH") {
          memo = {
            ...memo,
            ...JSON.parse(route.request().postData()),
            status: "pending",
            version: 2,
            error_code: null,
          };
          polls = 0;
        }
        if (url.searchParams.has("status_poll")) {
          polls++;
          memo = { ...memo, status: "ready", error_code: null };
        }
        data = memo;
      } else if (path.endsWith("/documents"))
        data = pageOf([memo, ...(pdf ? [pdf] : [])]);
      else data = pageOf([]);
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/documents", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "QA 메모", exact: true }).click();
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "자료 수정", exact: true });
    await edit
      .getByLabel("메모 본문", { exact: true })
      .fill("수정된 회의 메모");
    await edit.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByText("AI 반영 대기", { exact: true }).waitFor();
    await page
      .getByText("AI 반영 완료", { exact: true })
      .waitFor({ timeout: 12000 });
    assert.equal(polls, 1);
    assert.equal(indexCalls, 0);
    await page
      .getByRole("button", { name: "← 이전 페이지", exact: true })
      .click();
    await page.getByRole("button", { name: /PDF/ }).first().click();
    const upload = page.getByRole("dialog", {
      name: "PDF 업로드",
      exact: true,
    });
    await upload.getByLabel("자료 제목", { exact: true }).fill("QA PDF");
    const file = {
      name: "fixture.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fixture"),
    };
    await upload
      .getByLabel("PDF 파일 (최대 20MB)", { exact: true })
      .setInputFiles(file);
    await upload.getByRole("button", { name: "저장", exact: true }).click();
    await upload.getByText(/업로드를 완료하지 못했어요/).waitFor();
    await upload
      .getByLabel("PDF 파일 (최대 20MB)", { exact: true })
      .setInputFiles(file);
    await upload.getByRole("button", { name: "저장", exact: true }).click();
    await upload.waitFor({ state: "detached" });
    assert.equal(uploads, 1);
    assert.equal(resumes, 1);
    await page.getByRole("button", { name: "QA PDF", exact: true }).click();
    await page.getByText(/스캔 이미지 대신 텍스트가 포함된 PDF/).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /이 자료에 질문하기/ }).count(),
      0,
    );
    await page.screenshot({
      path: `/tmp/moadam-document-jobs-qa/failed-${width}.png`,
    });
    assert.deepEqual(errors, []);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await context.close();
    console.log(
      `PASS: automatic memo indexing status, stopped polling, resumed upload without duplicate row, visible OCR failure ${width}`,
    );
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
