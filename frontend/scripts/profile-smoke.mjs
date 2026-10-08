// Live integration check. Creates isolated users/groups and removes them in finally.
// Run: node --env-file=../.env scripts/profile-smoke.mjs
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
const origin = process.env.PROFILE_TEST_ORIGIN || "http://localhost:3000";
const supabase = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
assert(supabase && secret && key, "Supabase environment required");
const users = [];
let group;
const admin = async (path, method, body) => {
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
  assert(r.ok, `Admin request failed: ${r.status}`);
  return r.status === 204 ? null : r.json();
};
const request = async (
  user,
  path,
  method = "GET",
  body,
  status = 200,
  binary = false,
) => {
  const form = body instanceof FormData;
  const r = await fetch(`${origin}/api/proxy/${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(user ? { Cookie: `access=${user.token}` } : {}),
      ...(!form && body ? { "Content-Type": "application/json" } : {}),
    },
    body: form ? body : body && JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(r.status, status, `${method} ${path}: ${r.status}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
};
function png() {
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) {
      c ^= b;
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (name, data) => {
    const content = Buffer.concat([Buffer.from(name), data]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(content));
    return Buffer.concat([size, content, checksum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(1, 0);
  head.writeUInt32BE(1, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(Buffer.from([0, 255, 128, 0, 255]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const upload = (bytes) => {
  const f = new FormData();
  f.set("file", new Blob([bytes], { type: "image/png" }), "avatar.png");
  return f;
};
try {
  for (let i = 0; i < 2; i++) {
    const email = `profile-smoke-${crypto.randomUUID()}@example.com`,
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
    assert(r.ok, `Test login: ${r.status}`);
    user.token = (await r.json()).access_token;
  }
  const [a, b] = users;
  await request(null, "me", "GET", undefined, 401);
  assert.equal((await request(a, "me")).id, a.id);
  await request(a, "me", "PATCH", { display_name: " " }, 400);
  await request(a, "me", "PATCH", { display_name: "테스트 작성자" });
  group = (
    await request(a, "groups", "POST", {
      name: "프로필 자동검증",
      timezone: "Asia/Seoul",
    })
  ).id;
  const base = `groups/${group}`;
  const post = await request(a, `${base}/posts`, "POST", {
    title: "프로필 검증",
    body: "격리된 테스트",
    kind: "general",
  });
  const doc = await request(a, `${base}/documents`, "POST", {
    title: "등록자 검증",
    text: "테스트 메모",
    kind: "memo",
  });
  await request(a, `${base}/posts/${post.id}/comments`, "POST", {
    body: "댓글 작성자 검증",
  });
  assert.equal(post.author.display_name, "테스트 작성자");
  assert(!("email" in post.author));
  assert.equal((await request(a, "me/activity?type=posts")).total, 1);
  assert.equal(
    (await request(a, "me/activity?type=documents")).items[0].id,
    doc.id,
  );
  await request(a, "me/activity?type=invalid", "GET", undefined, 400);
  await request(a, "me/avatar", "POST", upload(Buffer.from("fake image")), 400);
  await request(a, "me/avatar", "POST", upload(Buffer.alloc(2200000)), 413);
  const profile = await request(a, "me/avatar", "POST", upload(png()));
  assert(profile.avatar_url);
  const image = await request(
    a,
    profile.avatar_url.replace("/api/proxy/", ""),
    "GET",
    undefined,
    200,
    true,
  );
  assert.equal(image.readUInt32BE(16), 512);
  assert.equal(image.readUInt32BE(20), 512);
  await request(b, `profiles/${a.id}/avatar`, "GET", undefined, 403);
  await request(a, "me", "PATCH", { display_name: "바뀐 닉네임" });
  assert.equal(
    (await request(a, `${base}/posts`)).items[0].author.display_name,
    "바뀐 닉네임",
  );
  assert.equal(
    (await request(a, `${base}/documents/${doc.id}`)).author.display_name,
    "바뀐 닉네임",
  );
  assert.equal(
    (await request(a, `${base}/posts/${post.id}/comments`)).items[0].author
      .display_name,
    "바뀐 닉네임",
  );
  assert.equal(
    (await request(a, `${base}/members`)).items[0].profile.display_name,
    "바뀐 닉네임",
  );
  const invite = await request(a, `${base}/invites`, "POST");
  await request(b, "invites/join", "POST", { token: invite.token });
  await request(b, `profiles/${a.id}/avatar`, "GET", undefined, 200, true);
  assert.equal((await request(b, "me/activity?type=posts")).total, 0);
  await request(b, `${base}/posts`, "POST", {
    title: "멤버 글",
    body: "탈퇴 후 숨김 검증",
    kind: "general",
  });
  assert.equal((await request(b, "me/activity?type=posts")).total, 1);
  await request(b, `${base}/membership`, "DELETE");
  assert.equal((await request(b, "me/activity?type=posts")).total, 0);
  assert.equal((await request(a, "me/avatar", "DELETE")).avatar_url, null);
  await request(a, `profiles/${a.id}/avatar`, "GET", undefined, 404);
  console.log(
    "Profile integration passed: nickname, authors, activities, avatar validation/access/deletion, membership boundaries.",
  );
} finally {
  if (group && users[0]?.token)
    await request(users[0], `groups/${group}`, "DELETE");
  for (const user of users) {
    if (user.token) await request(user, "me/avatar", "DELETE");
    await admin(`users/${user.id}`, "DELETE");
  }
  console.log("Isolated test users and group cleaned up.");
}
