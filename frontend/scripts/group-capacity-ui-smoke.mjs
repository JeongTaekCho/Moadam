import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const app = "http://localhost:3124";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3124"],
  { stdio: "ignore" },
);
const groupId = "11111111-1111-4111-8111-111111111111";
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    if (i === 99) throw Error("Server start failed");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true });
  await fs.mkdir("/tmp/moadam-capacity-qa", { recursive: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    await context.addCookies([
      { name: "access", value: "capacity-fixture", url: app, httpOnly: true },
    ]);
    const team = {
      id: groupId,
      name: "함께 읽는 모아 북클럽",
      timezone: "Asia/Seoul",
      role: "owner",
      max_members: 12,
      member_count: 5,
    };
    const writes = [];
    let rejectSave = false;
    await context.route("**/api/proxy/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace("/api/proxy/", "");
      let data = { items: [], total: 0, page: 0, size: 100 };
      if (path === "me")
        data = {
          id: "22222222-2222-4222-8222-222222222222",
          display_name: "QA",
          email: "qa@example.test",
          avatar_url: null,
        };
      else if (path === "groups" && request.method() === "GET")
        data = { ...data, items: [team], total: 1 };
      else if (path === `groups/${groupId}` && request.method() === "PATCH") {
        if (rejectSave)
          return route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              message:
                "현재 참여 인원은 8명입니다. 최대 인원을 8명 이상으로 설정해 주세요.",
            }),
          });
        const body = JSON.parse(request.postData());
        writes.push(body);
        Object.assign(team, body);
        data = team;
      } else if (path === "groups" && request.method() === "POST") {
        const body = JSON.parse(request.postData());
        writes.push(body);
        data = { ...team, ...body };
      } else if (path === "invites/join")
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            message:
              "모임 정원(12명)이 가득 찼어요. 모임 소유자에게 최대 인원 변경을 요청해 주세요.",
          }),
        });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(app + "/settings", { waitUntil: "networkidle" });
    const number = page.getByRole("spinbutton", {
      name: "모임 최대 인원 숫자 입력",
    });
    const slider = page.getByRole("slider", {
      name: "모임 최대 인원 슬라이더",
    });
    await number.waitFor();
    assert.equal(await number.inputValue(), "12");
    assert.equal(await slider.getAttribute("min"), "5");
    await number.fill("20");
    assert.equal(await slider.inputValue(), "20");
    await slider.focus();
    await slider.press("ArrowLeft");
    assert.equal(await number.inputValue(), "19");
    await slider.press("End");
    assert.equal(await number.inputValue(), "30");
    await number.fill("31");
    await number.blur();
    assert.equal(await number.inputValue(), "30");
    await number.fill("2");
    await number.blur();
    assert.equal(await number.inputValue(), "5");
    await number.fill("18");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByText("설정을 저장했습니다", { exact: true }).waitFor();
    assert.equal(writes.at(-1).max_members, 18);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await number.inputValue(), "18");
    rejectSave = true;
    await number.fill("5");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByText(/현재 참여 인원은 8명입니다/).waitFor();
    assert.equal(await number.inputValue(), "5");
    await page.screenshot({
      path: `/tmp/moadam-capacity-qa/settings-${width}.png`,
      fullPage: true,
    });
    rejectSave = false;
    if (width === 390)
      await page
        .getByRole("button", { name: "모임 메뉴 열기", exact: true })
        .click();
    await page
      .getByRole("button", { name: "모임 만들기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "모임 만들기",
      exact: true,
    });
    await dialog.waitFor();
    assert.equal(
      await dialog.getByText(/현재 참여 인원은 8명입니다/).count(),
      0,
    );
    assert.equal(await page.getByRole("dialog").count(), 1);
    const createNumber = dialog.getByRole("spinbutton");
    assert.equal(await createNumber.inputValue(), "30");
    await createNumber.fill("10");
    assert.equal(await dialog.getByRole("slider").inputValue(), "10");
    await dialog
      .getByLabel("모임 이름", { exact: true })
      .fill("새로운 독서 모임");
    await page.screenshot({
      path: `/tmp/moadam-capacity-qa/create-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(writes.at(-1).max_members, 10);
    if (width === 390)
      await page
        .getByRole("button", { name: "모임 메뉴 열기", exact: true })
        .click();
    await page.getByRole("button", { name: "초대 참여", exact: true }).click();
    await page
      .getByLabel("초대 코드", { exact: true })
      .fill("full-group-fixture");
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .last()
      .getByText(/모임 정원\(12명\)이 가득 찼어요/)
      .waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Capacity UI passed at 1440/390: input-slider sync, keyboard, limits, creation/save/reload and API error feedback (fixtures).",
  );
} finally {
  await browser?.close();
  server.kill();
}
