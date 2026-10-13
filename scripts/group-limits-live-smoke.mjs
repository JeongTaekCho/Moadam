// Explicit live QA: temporary Auth users and their groups are removed in finally.
// Run from the repository root: node --env-file=.env scripts/group-limits-live-smoke.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:8080";
const supabase = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(supabase && key && secret, "Supabase environment required");
const users = [];
const admin = async (path, method, body) => {
  const response = await fetch(`${supabase}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  assert(response.ok, `Admin request failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
};
async function identity() {
  const email = `group-limit-${randomUUID()}@example.test`,
    password = randomUUID() + "Aa!";
  const data = await admin("users", "POST", {
    email,
    password,
    email_confirm: true,
  });
  const user = { id: (data.user ?? data).id, token: null };
  users.push(user);
  const response = await fetch(
    `${supabase}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    },
  );
  assert(response.ok, `Fixture login failed: ${response.status}`);
  user.token = (await response.json()).access_token;
  return user;
}
async function call(user, path, method = "GET", body) {
  const response = await fetch(`${origin}/api/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, data: await response.json() };
}
async function ok(user, path, method, body) {
  const r = await call(user, path, method, body);
  assert.equal(r.status, 200, `${method ?? "GET"} ${path}: ${r.status}`);
  return r.data;
}
try {
  const a = await identity(),
    b = await identity();
  const parallel = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      call(a, "groups", "POST", {
        name: `QA limit ${i}`,
        timezone: "Asia/Seoul",
      }),
    ),
  );
  assert.equal(parallel.filter((r) => r.status === 200).length, 3);
  assert.equal(
    parallel.filter(
      (r) => r.status === 409 && r.data.code === "GROUP_LIMIT_REACHED",
    ).length,
    1,
  );
  const membership = await ok(a, "groups");
  assert.equal(membership.total, 3);
  const fourth = await ok(b, "groups", "POST", {
    name: "QA invite target",
    timezone: "Asia/Seoul",
  });
  const invite = await ok(b, `groups/${fourth.id}/invites`, "POST", {});
  const denied = await call(a, "invites/join", "POST", { token: invite.token });
  assert.equal(denied.status, 409);
  assert.equal(denied.data.code, "GROUP_LIMIT_REACHED");
  const unused = await ok(b, `groups/${fourth.id}/invites`);
  assert.equal(unused.items.find((i) => i.id === invite.id).used_at, null);
  await ok(a, `groups/${membership.items[0].id}`, "DELETE");
  await ok(a, "invites/join", "POST", { token: invite.token });
  assert.equal((await ok(a, "groups")).total, 3);
  // Already joined: do not consume a second invitation even when at the limit.
  const second = await ok(b, `groups/${fourth.id}/invites`, "POST", {});
  await ok(a, "invites/join", "POST", { token: second.token });
  assert.equal(
    (await ok(b, `groups/${fourth.id}/invites`)).items.find(
      (i) => i.id === second.id,
    ).used_at,
    null,
  );
  const groups = (await ok(a, "groups")).items;
  assert.equal((await ok(a, "me/ai-usage")).remaining, 30);
  for (const [i, group] of groups.slice(0, 2).entries()) {
    const session = await ok(a, `groups/${group.id}/chat/sessions`, "POST", {
      title: "QA empty group",
    });
    // Fresh empty groups have no model context; this check never indexes data or calls a paid model.
    const response = await fetch(
      `${origin}/api/v1/groups/${group.id}/chat/sessions/${session.id}/messages/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${a.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: "등록된 자료가 있나요?" }),
        signal: AbortSignal.timeout(30000),
      },
    );
    assert.equal(response.status, 200);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      events.find((e) => e.type === "usage").usage.remaining,
      29 - i,
    );
  }
  assert.equal((await ok(a, "me/ai-usage")).remaining, 28);
  assert.equal((await ok(b, "me/ai-usage")).remaining, 30);
  console.log(
    "PASS: four concurrent creates -> three memberships, join rejection preserves invite, slot reuse, idempotent join, AI quota shared across groups and isolated by user",
  );
} finally {
  const failures = [];
  for (const user of users) {
    try {
      if (user.token) {
        const groups = await ok(user, "groups");
        for (const group of groups.items.filter((g) => g.role === "owner"))
          await ok(user, `groups/${group.id}`, "DELETE");
        await fetch(`${supabase}/auth/v1/logout?scope=global`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${user.token}` },
          signal: AbortSignal.timeout(10000),
        });
      }
      await admin(`users/${user.id}`, "DELETE");
    } catch {
      failures.push("Fixture cleanup failed");
    }
  }
  assert.equal(
    failures.length,
    0,
    "Some fixture cleanup failed; investigate before rerunning",
  );
  console.log("PASS: temporary groups and Auth users cleaned up");
}
