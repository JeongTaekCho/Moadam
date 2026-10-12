import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const app = "http://localhost:3114",
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3114"],
  { stdio: "ignore" },
);
let browser;
const group = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  target = "33333333-3333-4333-8333-333333333333",
  stamp = "2026-10-12T01:00:00Z";
const author = { id: user, display_name: "모아 QA", avatar_url: null },
  other = {
    id: "44444444-4444-4444-8444-444444444444",
    display_name: "모아 이웃",
    avatar_url: null,
  };
const profile = {
  ...author,
  email: "qa@example.test",
  created_at: stamp,
  updated_at: stamp,
};
const post = {
  id: target,
  group_id: group,
  author_id: user,
  author,
  title: "모임에서 함께 나누는 이야기",
  body: "함께 읽은 책에 대한 생각을 나눠 주세요.\n\n어떤 구절이 가장 기억에 남았나요?",
  kind: "question",
  created_at: stamp,
  updated_at: stamp,
};
const event = {
  ...post,
  title: "가을 독서 모임",
  description:
    "책 한 권과 편안한 마음을 준비해 주세요.\n함께 이야기 나누며 모임을 이어가요.",
  location: "서울 작은 서재",
  starts_at: "2026-10-24T01:00:00Z",
  ends_at: "2026-10-24T03:00:00Z",
};
const paged = (items) => ({ items, page: 0, size: 100, total: items.length });
const root = "/tmp/moadam-discussion-qa";
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    await wait(200);
    if (i === 99) throw Error("Server failed");
  }
  browser = await chromium.launch({ headless: true });
  await fs.mkdir(root, { recursive: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      hasTouch: width === 390,
    });
    await context.addCookies([
      { name: "access", value: "discussion-fixture", url: app, httpOnly: true },
    ]);
    let serial = 0,
      failed = false;
    const comments = { posts: [], events: [] },
      writes = [];
    const comment = (kind, body, parent_id = null, owner = author) => ({
      id: `55555555-5555-4555-8555-${String(++serial).padStart(12, "0")}`,
      group_id: group,
      [kind === "posts" ? "post_id" : "event_id"]: target,
      parent_id,
      deleted: false,
      author_id: owner.id,
      author: owner,
      body,
      created_at: stamp,
      updated_at: stamp,
    });
    for (const kind of ["posts", "events"]) {
      const original = comment(kind, "좋은 이야기 기대해요.", null, other);
      comments[kind].push(
        original,
        comment(kind, "저도 함께할게요!", original.id),
      );
    }
    await context.route("**/api/proxy/**", async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname.replace("/api/proxy/", ""),
        method = route.request().method();
      let data;
      const matched = path.match(
        /\/(posts|events)\/[^/]+\/comments(?:\/([^/]+))?$/,
      );
      if (matched) {
        const [, kind, id] = matched;
        const items = comments[kind];
        if (method === "GET") data = paged(items);
        else if (method === "POST") {
          if (!failed) {
            failed = true;
            await route.fulfill({
              status: 503,
              json: { code: "HTTP_503", message: "잠시 후 다시 시도해 주세요" },
            });
            return;
          }
          const body = JSON.parse(route.request().postData());
          writes.push({ kind, ...body });
          data = comment(kind, body.body, body.parent_id);
          items.push(data);
        } else if (method === "PATCH") {
          data = items.find((item) => item.id === id);
          data.body = JSON.parse(route.request().postData()).body;
          data.updated_at = "2026-10-12T02:00:00Z";
        } else {
          data = items.find((item) => item.id === id);
          data.deleted = true;
          data.body = "삭제된 댓글입니다";
          data = { deleted: true };
        }
      } else if (path === "me") data = profile;
      else if (path === "groups")
        data = paged([
          {
            id: group,
            name: "모아 북클럽",
            timezone: "Asia/Seoul",
            role: "member",
          },
        ]);
      else if (path.endsWith("/posts")) data = paged([post]);
      else if (path.endsWith(`/posts/${target}`)) data = post;
      else if (path.endsWith("/events")) data = paged([event]);
      else if (path.endsWith(`/events/${target}`)) data = event;
      else if (path.endsWith("/attendance")) data = [];
      else {
        await route.fulfill({
          status: 404,
          json: { message: "Unexpected fixture route: " + path },
        });
        return;
      }
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date(stamp));
    await page.goto(app + "/community", { waitUntil: "networkidle" });
    const card = page.locator(".post-card");
    await card.waitFor();
    const box = await card.boundingBox();
    assert(box);
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 12);
    await page
      .locator(".community-detail")
      .getByRole("heading", { name: post.title, exact: true })
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    async function flow(kind) {
      const discussion = page.locator(".discussion-section");
      await discussion
        .locator(".discussion-threads")
        .getByText("좋은 이야기 기대해요.", { exact: true })
        .waitFor();
      assert.equal(await discussion.locator("button button").count(), 0);
      const foreign = discussion.locator(
        `[data-comment-id="${comments[kind][0].id}"]`,
      );
      assert.equal(
        await foreign
          .getByRole("button", { name: "삭제", exact: true })
          .count(),
        0,
      );
      const input = discussion.getByLabel("댓글 작성", { exact: true });
      await input.fill("작성 중인 댓글입니다.");
      if (!failed) {
        await discussion
          .getByRole("button", { name: "댓글 등록", exact: true })
          .click();
        await discussion
          .getByRole("alert")
          .getByText("잠시 후 다시 시도해 주세요", { exact: true })
          .waitFor();
        assert.equal(await input.inputValue(), "작성 중인 댓글입니다.");
      }
      await input.press("Control+Enter");
      await discussion
        .locator(".discussion-threads")
        .getByText("작성 중인 댓글입니다.", { exact: true })
        .waitFor();
      assert.equal(await input.inputValue(), "");
      const created = comments[kind].at(-1);
      const article = discussion.locator(`[data-comment-id="${created.id}"]`);
      await article.getByRole("button", { name: "답글", exact: true }).click();
      const reply = discussion.getByLabel("답글 작성", { exact: true });
      await reply.fill("답글 초안");
      await reply.press("Escape");
      assert.equal(await reply.count(), 0);
      await article.getByRole("button", { name: "답글", exact: true }).click();
      await reply.fill("자연스럽게 이어지는 답글");
      await discussion
        .getByRole("button", { name: "답글 등록", exact: true })
        .click();
      await discussion
        .locator(".discussion-threads")
        .getByText("자연스럽게 이어지는 답글", { exact: true })
        .waitFor();
      assert.equal(writes.at(-1).parent_id, created.id);
      const newReply = comments[kind].at(-1),
        replyArticle = discussion.locator(`[data-comment-id="${newReply.id}"]`);
      await replyArticle
        .getByRole("button", { name: "답글", exact: true })
        .click();
      await reply.fill("대댓글에 대한 답변");
      await discussion
        .getByRole("button", { name: "답글 등록", exact: true })
        .click();
      await discussion
        .locator(".discussion-threads")
        .getByText("대댓글에 대한 답변", { exact: true })
        .waitFor();
      assert.equal(writes.at(-1).parent_id, created.id);
      await replyArticle
        .getByRole("button", { name: "수정", exact: true })
        .click();
      await discussion
        .getByLabel("댓글 수정", { exact: true })
        .fill("수정한 답글");
      await discussion
        .getByRole("button", { name: "수정 저장", exact: true })
        .click();
      await discussion
        .locator(".discussion-threads")
        .getByText("수정한 답글", { exact: true })
        .waitFor();
      await article.getByRole("button", { name: "삭제", exact: true }).click();
      await article
        .getByRole("button", { name: "삭제 확인", exact: true })
        .click();
      await article.getByText("삭제된 댓글입니다", { exact: true }).waitFor();
      assert(
        await replyArticle
          .getByRole("button", { name: "답글", exact: true })
          .isDisabled(),
      );
      assert.equal(
        await discussion
          .locator(".discussion-threads")
          .getByText("수정한 답글", { exact: true })
          .count(),
        1,
      );
      assert.equal(await page.getByRole("dialog").count(), 0);
      await input.fill("다른 상세로 이동하면 남지 않을 초안");
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: `${root}/${kind}-${width}.png`,
        fullPage: true,
      });
    }
    assert.equal(new URL(page.url()).pathname, `/community/${target}`);
    assert.equal(new URL(page.url()).searchParams.get("group"), group);
    await page.reload({ waitUntil: "networkidle" });
    await page
      .locator(".community-detail")
      .getByRole("heading", { name: post.title, exact: true })
      .waitFor();
    await page.goBack();
    await page.locator(".post-card").waitFor();
    await page.goForward();
    await page
      .locator(".community-detail")
      .getByRole("heading", { name: post.title, exact: true })
      .waitFor();
    await flow("posts");
    await page
      .getByRole("button", { name: "커뮤니티로 돌아가기", exact: true })
      .click();
    await page.getByRole("button", { name: post.title, exact: true }).focus();
    await page.keyboard.press("Enter");
    await page
      .locator(".community-detail")
      .getByRole("heading", { name: post.title, exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("댓글 작성", { exact: true }).inputValue(),
      "",
    );
    await page.goto(app + "/events", { waitUntil: "networkidle" });
    await page
      .locator(".events-month-list")
      .getByRole("button", { name: event.title, exact: true })
      .click();
    await page
      .getByRole("heading", { name: event.title, exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, `/events/${target}`);
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: event.title, exact: true })
      .waitFor();
    await flow("events");
    await page.goto(`${app}/community/${target}?group=${group}`, {
      waitUntil: "networkidle",
    });
    await page
      .locator(".community-detail")
      .getByRole("heading", { name: post.title, exact: true })
      .waitFor();
    await page.goto(`${app}/events/${target}?group=${group}`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("heading", { name: event.title, exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS: full-card/keyboard navigation, inline comments/replies, failed draft retry, editing, deletion preserves replies, resource isolation and mobile ${width}`,
    );
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
