// Isolated live integration. Uses the configured provider for one indexed memo.
import assert from "node:assert/strict";
const origin = process.env.CHAT_TEST_ORIGIN || "http://localhost:3000";
const supabase = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(supabase && key && secret);
const users = [];
let group;
async function admin(path, method, body) {
  const r = await fetch(`${supabase}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  assert(r.ok, `Admin ${r.status}`);
  return r.status === 204 ? null : r.json();
}
async function request(user, path, method = "GET", body, status = 200) {
  const r = await fetch(`${origin}/api/proxy/${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(user ? { Cookie: `access=${user.token}` } : {}),
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  assert.equal(r.status, status, `${method} ${path}`);
  return r;
}
async function json(user, path, method, body, status) {
  return (await request(user, path, method, body, status)).json();
}
async function ask(user, path) {
  const start = performance.now();
  let first,
    deltas = 0,
    received = "",
    completed;
  const r = await request(user, path, "POST", {
    question: "정기 회의는 언제 어디서 진행하나요?",
  });
  assert(r.headers.get("content-type").startsWith("application/x-ndjson"));
  const reader = r.body.getReader(),
    decoder = new TextDecoder();
  let pending = "";
  for (;;) {
    const { value, done } = await reader.read();
    pending += done
      ? decoder.decode()
      : decoder.decode(value, { stream: true });
    let newline;
    while ((newline = pending.indexOf("\n")) >= 0) {
      const event = JSON.parse(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
      assert.notEqual(event.type, "error", event.message);
      if (event.type === "delta") {
        first ??= performance.now();
        deltas++;
        received += event.text;
      }
      if (event.type === "done") completed = event;
    }
    if (done) break;
  }
  assert(completed && deltas > 0, "Deltas and committed completion");
  assert.equal(received, completed.assistant.content);
  console.log(
    `Live stream: ${deltas} deltas, first text ${Math.round(first - start)}ms, complete ${Math.round(performance.now() - start)}ms.`,
  );
  return completed;
}
try {
  for (let i = 0; i < 2; i++) {
    const email = `chat-smoke-${crypto.randomUUID()}@example.com`,
      password = `${crypto.randomUUID()}Aa9!`;
    const created = await admin("users", "POST", {
      email,
      password,
      email_confirm: true,
    });
    const user = { id: created.id };
    users.push(user);
    const r = await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20000),
    });
    assert(r.ok);
    user.token = (await r.json()).access_token;
  }
  const [owner, other] = users;
  group = (
    await json(owner, "groups", "POST", {
      name: "스트리밍 격리 검증",
      timezone: "Asia/Seoul",
    })
  ).id;
  const base = `groups/${group}`;
  const session = await json(owner, `${base}/chat/sessions`, "POST", {
    title: "스트리밍 검증",
  });
  const path = `${base}/chat/sessions/${session.id}/messages/stream`;
  await json(null, path, "POST", { question: "권한 확인" }, 401);
  const invite = await json(owner, `${base}/invites`, "POST");
  await json(other, "invites/join", "POST", { token: invite.token });
  await json(other, path, "POST", { question: "타인의 대화" }, 404);
  await json(owner, path, "POST", { question: "" }, 400);
  const missing = await ask(owner, path);
  assert.equal(missing.assistant.grounded, false);
  const memo = await json(owner, `${base}/documents`, "POST", {
    title: "정기 회의 안내",
    kind: "memo",
    text: "검증 모임의 정기 회의는 매주 금요일 오후 7시에 온라인 회의실에서 진행합니다. 준비물은 회의 메모입니다.",
  });
  const indexed = await json(
    owner,
    `${base}/documents/${memo.id}/index`,
    "POST",
  );
  assert.equal(indexed.status, "ready", "Memo indexed by configured provider");
  const answer = await ask(owner, path);
  assert(answer.assistant.grounded);
  assert.equal(answer.assistant.citations[0].document_id, memo.id);
  const history = await json(
    owner,
    `${base}/chat/sessions/${session.id}/messages?size=100`,
  );
  assert.equal(history.total, 4);
  assert.equal(history.items.at(-1).id, answer.assistant.id);
  assert.equal(history.items.at(-1).content, answer.assistant.content);
  console.log(
    "Live chat passed: authenticated streaming, own session boundary, validation, missing evidence, indexed memo citations and persisted history.",
  );
} finally {
  if (group && users[0]?.token)
    await json(users[0], `groups/${group}`, "DELETE");
  for (const user of users) await admin(`users/${user.id}`, "DELETE");
  console.log("Isolated chat users, group and documents cleaned up.");
}
