import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const app = "http://localhost:3113",
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3113"],
  { stdio: "ignore" },
);
let browser;
const root = "/tmp/moadam-calendar-qa";
const group = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222";
const author = { id: user, display_name: "모아 QA", avatar_url: null };
const profile = {
  ...author,
  email: "qa@example.test",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};
const team = {
  id: group,
  name: "모아 북클럽",
  timezone: "Asia/Seoul",
  role: "owner",
};
const event = (index, title, start, end) => ({
  id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
  group_id: group,
  author_id: user,
  author,
  title,
  starts_at: new Date(start + "+09:00").toISOString(),
  ends_at: new Date(end + "+09:00").toISOString(),
  description: "함께 읽고 이야기를 나누는 시간이에요.\n준비물을 챙겨 주세요.",
  location: "성수동 작은 서재",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});
const fixture = [
  event(99, "지난 일정", "2026-10-11T00:00", "2026-10-12T00:00"),
  event(1, "가을 워크숍", "2026-10-12T00:00", "2026-10-20T00:00"),
  event(2, "함께 읽는 책", "2026-10-12T14:00", "2026-10-12T16:00"),
  event(3, "독서 여행", "2026-10-13T00:00", "2026-10-16T00:00"),
  event(4, "동네 산책", "2026-10-12T09:00", "2026-10-12T10:00"),
  event(5, "온라인 질문 모임", "2026-10-12T10:00", "2026-10-12T11:00"),
];
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    await sleep(200);
    if (i === 79) throw Error("Server start failed");
  }
  browser = await chromium.launch({ headless: true });
  await fs.mkdir(root, { recursive: true });
  for (const [width, timezoneId] of [
    [1440, "Asia/Seoul"],
    [390, "America/Los_Angeles"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      timezoneId,
      hasTouch: width === 390,
      isMobile: width === 390,
    });
    await context.addCookies([
      { name: "access", value: "calendar-fixture", url: app, httpOnly: true },
    ]);
    let events = structuredClone(fixture),
      writes = [],
      calls = [],
      status = "maybe";
    await context.route("**/api/proxy/**", async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname.replace("/api/proxy/", ""),
        method = route.request().method();
      calls.push(path + url.search);
      let data;
      if (path.endsWith("/comments"))
        data = { items: [], total: 0, page: 0, size: 100 };
      else if (path === "me") data = profile;
      else if (path === "groups")
        data = { items: [team], total: 1, size: 100, page: 0 };
      else if (path.endsWith("/attendance")) {
        if (method === "PUT")
          status = JSON.parse(route.request().postData()).status;
        data = method === "PUT" ? { saved: true } : [{ user_id: user, status }];
      } else if (path.endsWith("/events") && method === "POST") {
        const body = JSON.parse(route.request().postData());
        writes.push(body);
        data = {
          ...event(
            events.length + 1,
            body.title,
            "2026-10-12T00:00",
            "2026-10-13T00:00",
          ),
          ...body,
        };
        events.push(data);
      } else if (method === "GET" && /\/events\/[^/]+$/.test(path)) {
        data = events.find((event) => event.id === path.split("/").at(-1));
      } else if (method === "PATCH") {
        const body = JSON.parse(route.request().postData());
        writes.push(body);
        const id = path.split("/").at(-1);
        const index = events.findIndex((event) => event.id === id);
        data = events[index] = { ...events[index], ...body };
      } else {
        const from = url.searchParams.get("from");
        const items = events
          .filter((event) => !from || event.ends_at >= from)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        data = { items, total: items.length, size: 100, page: 0 };
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-12T01:00:00Z"));
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(app + "/events", { waitUntil: "networkidle" });
    await page.locator(".schedule-ribbon").first().waitFor();
    assert.equal(await page.locator(".react-calendar__tile").count(), 42);
    assert.equal(
      await page
        .getByRole("button", { name: /가을 워크숍,.*하루 종일/ })
        .count(),
      2,
    );
    assert(
      calls.some((call) => call.includes("/events?page=0&size=100&from=")),
    );
    const boxes = await page.locator(".month-navigation").evaluate((element) =>
      [...element.children].map((child) => {
        const r = child.getBoundingClientRect();
        return r.top + r.height / 2;
      }),
    );
    assert(Math.max(...boxes) - Math.min(...boxes) < 2);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.equal(await page.locator("button button").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "2026-10-11 새 일정", exact: true })
        .count(),
      0,
    );
    const dayTile = (day) =>
      page.locator(`.react-calendar__tile:has([data-calendar-day="${day}"])`);
    const hoverDay = async (day) => {
      await dayTile(day).evaluate((tile) =>
        tile.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await dayTile(day).hover({ position: { x: 5, y: 5 } });
    };
    const createDay = (day) =>
      page.getByRole("button", { name: `${day} 새 일정`, exact: true });
    const clickCreate = async (day) => {
      const button = createDay(day);
      if (width === 390)
        await button.evaluate((button) =>
          button.scrollIntoView({ block: "center", behavior: "instant" }),
        );
      await page.waitForFunction((day) => {
        const button = document.querySelector(
          `.schedule-create[data-calendar-day="${day}"]`,
        );
        return button && getComputedStyle(button).opacity === "1";
      }, day);
      const box = await button.boundingBox();
      assert(
        box && box.y > 64 && box.y + box.height < 1000,
        `Create button outside viewport: ${JSON.stringify(box)}`,
      );
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      assert.equal(
        await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x, y)
              ?.closest("button")
              ?.getAttribute("data-calendar-day"),
          { x, y },
        ),
        day,
      );
      if (width === 390) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    };
    if (width === 390) {
      await dayTile("2026-10-14").tap({ position: { x: 5, y: 5 } });
    } else {
      await hoverDay("2026-10-12");
      await createDay("2026-10-12").waitFor();
      assert.equal(
        await createDay("2026-10-12").evaluate(
          (button) => getComputedStyle(button).pointerEvents,
        ),
        "auto",
      );
      await hoverDay("2026-10-14");
    }
    await clickCreate("2026-10-14");
    const quickDialog = page.getByRole("dialog", {
      name: "새 일정",
      exact: true,
    });
    assert.equal(
      await quickDialog
        .getByLabel("시작일 (년-월-일)", { exact: true })
        .inputValue(),
      "2026-10-14",
    );
    assert.equal(
      await quickDialog
        .getByLabel("종료일 (년-월-일)", { exact: true })
        .inputValue(),
      "2026-10-14",
    );
    await quickDialog
      .getByRole("button", { name: "닫기", exact: true })
      .click();
    await createDay("2026-10-15").focus();
    assert.equal(
      await createDay("2026-10-15").evaluate(
        (button) => getComputedStyle(button).pointerEvents,
      ),
      "auto",
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await quickDialog
        .getByLabel("시작일 (년-월-일)", { exact: true })
        .inputValue(),
      "2026-10-15",
    );
    await quickDialog
      .getByRole("button", { name: "닫기", exact: true })
      .click();
    if (width === 390) {
      await dayTile("2026-11-01").evaluate((tile) =>
        tile.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await dayTile("2026-11-01").tap({ position: { x: 5, y: 5 } });
    } else await hoverDay("2026-11-01");
    await clickCreate("2026-11-01");
    assert.equal(
      await quickDialog
        .getByLabel("시작일 (년-월-일)", { exact: true })
        .inputValue(),
      "2026-11-01",
    );
    await quickDialog
      .getByRole("button", { name: "닫기", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "2026년 11월", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    await page
      .getByRole("heading", { name: "2026년 10월", exact: true })
      .waitFor();
    await dayTile("2026-10-12").click({ position: { x: 5, y: 5 } });
    await hoverDay("2026-10-14");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `${root}/calendar-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    await page
      .getByRole("heading", { name: "2026년 9월", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "다음 달", exact: true }).click();
    await page
      .getByRole("heading", { name: "2026년 10월", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "일정 만들기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "새 일정", exact: true });
    assert(
      await dialog
        .getByLabel("시작일과 종료일이 같음", { exact: true })
        .isChecked(),
    );
    assert(
      !(await dialog.getByLabel("시간 추가", { exact: true }).isChecked()),
    );
    assert(
      await dialog
        .getByLabel("종료일 (년-월-일)", { exact: true })
        .isDisabled(),
    );
    assert(
      await dialog
        .getByLabel("시작 시간 (24시간 시:분)", { exact: true })
        .isDisabled(),
    );
    await dialog
      .getByRole("button", { name: "시작일 달력 열기", exact: true })
      .click();
    assert(
      await page
        .locator('.picker-popover:popover-open [data-day="2026-10-11"]')
        .isDisabled(),
    );
    assert(
      await page
        .locator('.picker-popover:popover-open [data-day="2026-10-12"]')
        .isEnabled(),
    );
    await page.keyboard.press("Escape");
    const fields = await dialog
      .locator("input:not([type=hidden])")
      .evaluateAll((inputs) =>
        inputs.map((input) => input.getAttribute("aria-label") || input.name),
      );
    assert(fields[0].startsWith("시작일"));
    const selectDate = async (label, day) => {
      await dialog
        .getByRole("button", { name: label + " 달력 열기", exact: true })
        .click();
      await page
        .locator(`.picker-popover:popover-open [data-day="${day}"]`)
        .click();
    };
    await selectDate("시작일", "2026-10-12");
    assert.equal(
      await dialog
        .getByLabel("종료일 (년-월-일)", { exact: true })
        .inputValue(),
      "2026-10-12",
    );
    const clipped = await dialog
      .locator(".event-date-inputs .picker-control input")
      .evaluateAll((inputs) =>
        inputs.some((input) => {
          const style = getComputedStyle(input);
          const context = document.createElement("canvas").getContext("2d");
          context.font = style.font;
          return (
            context.measureText(input.value).width >
            input.clientWidth -
              parseFloat(style.paddingLeft) -
              parseFloat(style.paddingRight)
          );
        }),
      );
    assert.equal(
      clipped,
      false,
      "Selected dates must remain fully visible on mobile",
    );
    await dialog.getByLabel("일정 제목", { exact: true }).fill("새 하루 일정");
    await page.screenshot({ path: `${root}/form-${width}.png` });
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(writes[0].starts_at, "2026-10-11T15:00:00.000Z");
    assert.equal(writes[0].ends_at, "2026-10-12T15:00:00.000Z");
    assert.deepEqual(Object.keys(writes[0]).sort(), [
      "description",
      "ends_at",
      "location",
      "starts_at",
      "title",
    ]);
    await page
      .getByRole("button", { name: "일정 만들기", exact: true })
      .click();
    await selectDate("시작일", "2026-10-12");
    await dialog
      .getByLabel("시작일과 종료일이 같음", { exact: true })
      .uncheck();
    await selectDate("종료일", "2026-10-15");
    await dialog.getByLabel("시간 추가", { exact: true }).check();
    assert(
      await dialog
        .getByLabel("시작 시간 (24시간 시:분)", { exact: true })
        .isEnabled(),
    );
    await dialog
      .getByLabel("일정 제목", { exact: true })
      .fill("새 여러 날 일정");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(writes[1].starts_at, "2026-10-12T00:00:00.000Z");
    assert.equal(writes[1].ends_at, "2026-10-15T01:00:00.000Z");
    await page
      .getByRole("button", { name: /가을 워크숍,.*하루 종일/ })
      .first()
      .click();
    await page.locator(".event-detail").waitFor();
    await page
      .getByRole("heading", { name: "가을 워크숍", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "아직 고민 중", exact: false })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `${root}/detail-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "참석할게요", exact: false })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('.event-attendance-options button[aria-pressed="true"]')
        ?.textContent.includes("참석할게요"),
    );
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "일정 수정", exact: true });
    assert(
      !(await edit
        .getByLabel("시작일과 종료일이 같음", { exact: true })
        .isChecked()),
    );
    assert(!(await edit.getByLabel("시간 추가", { exact: true }).isChecked()));
    assert.equal(
      await edit.getByLabel("종료일 (년-월-일)", { exact: true }).inputValue(),
      "2026-10-19",
    );
    await edit.getByLabel("일정 제목", { exact: true }).fill("수정된 워크숍");
    await edit.getByRole("button", { name: "저장", exact: true }).click();
    await edit.waitFor({ state: "hidden" });
    await page
      .getByRole("heading", { name: "수정된 워크숍", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "일정으로 돌아가기", exact: true })
      .click();
    await page.getByRole("button", { name: /지난 일정,.*하루 종일/ }).click();
    await page
      .getByRole("heading", { name: "지난 일정", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".event-attendance-options button:disabled").count(),
      3,
    );
    await page
      .getByText("시작일이 지난 일정은 참석 응답을 변경할 수 없어요.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const pastEditor = page.getByRole("dialog", {
      name: "일정 수정",
      exact: true,
    });
    const dateMessage =
      "시작일이 오늘보다 전입니다. 시작일을 오늘 또는 이후 날짜로 수정해 주세요.";
    await pastEditor.getByText(dateMessage, { exact: true }).waitFor();
    const startControl = pastEditor.getByLabel("시작일 (년-월-일)", {
      exact: true,
    });
    assert.equal(await startControl.getAttribute("aria-invalid"), "true");
    for (const label of ["시작일", "종료일"]) {
      const dateInput = pastEditor.getByLabel(`${label} (년-월-일)`, {
        exact: true,
      });
      const calendarButton = pastEditor.getByRole("button", {
        name: `${label} 달력 열기`,
        exact: true,
      });
      const inputBox = await dateInput.boundingBox(),
        buttonBox = await calendarButton.boundingBox();
      assert(inputBox && buttonBox);
      assert(buttonBox.height <= inputBox.height + 2);
    }
    assert(
      await pastEditor.evaluate((node) => node.scrollWidth <= node.clientWidth),
    );
    await page.screenshot({ path: `${root}/past-date-error-${width}.png` });
    await pastEditor
      .getByRole("button", { name: "시작일 달력 열기", exact: true })
      .click();
    await page
      .locator('.picker-popover:popover-open [data-day="2026-10-12"]')
      .click();
    assert.equal(
      await pastEditor.getByText(dateMessage, { exact: true }).count(),
      0,
    );
    await pastEditor.getByRole("button", { name: "닫기", exact: true }).click();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS: calendar, aligned navigation, forms, period storage, details, attendance and edit",
      width,
      timezoneId,
    );
  }
  // The calendar gathers all pages instead of losing events after the first 100.
  const bulk = await browser.newContext();
  await bulk.addCookies([
    { name: "access", value: "bulk-fixture", url: app, httpOnly: true },
  ]);
  let pages = [];
  const events = Array.from({ length: 105 }, (_, index) =>
    event(
      index + 1,
      "겹친 일정 " + index,
      "2026-10-12T00:00",
      "2026-10-13T00:00",
    ),
  );
  await bulk.route("**/api/proxy/**", (route) => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname.endsWith("/me")) data = profile;
    else if (url.pathname.endsWith("/groups"))
      data = { items: [team], size: 100, total: 1, page: 0 };
    else {
      const page = Number(url.searchParams.get("page") || 0);
      pages.push(page);
      data = {
        items: events.slice(page * 100, page * 100 + 100),
        size: 100,
        total: 105,
        page,
      };
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  const bp = await bulk.newPage();
  await bp.clock.setFixedTime(new Date("2026-10-12T01:00:00Z"));
  await bp.goto(app + "/events", { waitUntil: "networkidle" });
  await bp.locator(".agenda-event").first().waitFor();
  assert.deepEqual(pages, [0, 1]);
  assert.equal(await bp.locator(".agenda-event").count(), 105);
  assert.equal(await bp.locator(".schedule-ribbon").count(), 3);
  assert.match(await bp.locator(".schedule-more").innerText(), /102/);
  await bulk.close();
  console.log("PASS: 105-event pagination and overflow; screenshots:", root);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
