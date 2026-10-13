// Explicit live QA: uses temporary Auth/Storage data and a few small provider requests.
// Run at repository root: node --env-file=.env scripts/document-jobs-live-smoke.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const origin = "http://127.0.0.1:8080",
  url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
let user, token, group;
const admin = async (path, method, body) => {
  const r = await fetch(`${url}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: secret,
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  assert(r.ok, `Admin ${r.status}`);
  return r.status === 204 ? null : r.json();
};
const call = async (path, method = "GET", body) => {
  const r = await fetch(`${origin}/api/v1/${path}`, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: r.status, data: await r.json() };
};
const ok = async (...a) => {
  const r = await call(...a);
  assert.equal(r.status, 200, `${a[0]} ${r.status}`);
  return r.data;
};
const sql = (query, args) =>
  JSON.parse(
    execFileSync(
      "rag/.venv/bin/python",
      [
        "-c",
        `import sys,json,psycopg\nfrom dotenv import dotenv_values\np=json.load(sys.stdin)\ncfg=dotenv_values('rag/.env')\nwith psycopg.connect(cfg['DATABASE_URL'],connect_timeout=10) as c:\n with c.cursor() as q:\n  q.execute(p['query'],p['args'])\n  print(json.dumps(q.fetchall() if q.description else [],default=str))`,
      ],
      { input: JSON.stringify({ query, args }), encoding: "utf8" },
    ),
  );
async function waitDoc(id, status) {
  for (let n = 0; n < 40; n++) {
    const d = await ok(`groups/${group}/documents/${id}`);
    if (d.status === status) return d;
    if (d.status === "failed" && status === "ready")
      throw Error("Live indexing failed: " + d.error_code);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("Index completion timeout");
}
try {
  const email = `document-jobs-${randomUUID()}@example.test`,
    password = randomUUID() + "Aa!";
  const u = await admin("users", "POST", {
    email,
    password,
    email_confirm: true,
  });
  user = (u.user ?? u).id;
  const auth = await fetch(url + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(auth.ok);
  token = (await auth.json()).access_token;
  group = (
    await ok("groups", "POST", {
      name: "QA durable docs",
      timezone: "Asia/Seoul",
    })
  ).id;
  const start = Date.now();
  const memo = await ok(`groups/${group}/documents`, "POST", {
    title: "QA memo",
    kind: "memo",
    text: "테스트 회의는 금요일에 열립니다.",
  });
  assert(Date.now() - start < 5000);
  assert.equal(memo.status, "pending");
  await waitDoc(memo.id, "ready");
  await ok(`groups/${group}/documents/${memo.id}`, "PATCH", {
    title: "QA memo",
    text: "테스트 회의는 토요일에 열립니다.",
  });
  const updated = await waitDoc(memo.id, "ready");
  assert.equal(updated.version, 2);
  const count = sql(
    "select indexed from document_daily_usage where user_id=%s and usage_date=(current_timestamp at time zone 'Asia/Seoul')::date",
    [user],
  )[0][0];
  await ok(`groups/${group}/documents/${memo.id}/index`, "POST", {});
  assert.equal(
    sql(
      "select indexed from document_daily_usage where user_id=%s and usage_date=(current_timestamp at time zone 'Asia/Seoul')::date",
      [user],
    )[0][0],
    count,
  );
  const session = await ok(`groups/${group}/chat/sessions`, "POST", {
    title: "QA current-version answer",
  });
  const stream = await fetch(
    `${origin}/api/v1/groups/${group}/chat/sessions/${session.id}/messages/stream`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: "회의는 무슨 요일에 열리나요?" }),
    },
  );
  assert.equal(stream.status, 200);
  const events = (await stream.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const done = events.find((e) => e.type === "done");
  assert(done, "Grounded answer did not complete");
  assert(done.assistant.content.includes("토요일"));
  assert.equal(done.assistant.grounded, true);
  console.log(
    "PASS: real auto-index creation/edit, current-version grounded answer and free idempotent retry",
  );
  // A valid empty PDF exercises Storage and permanent OCR feedback without embedding calls.
  const payload = execFileSync("rag/.venv/bin/python", [
    "-c",
    "import io,sys;from pypdf import PdfWriter;w=PdfWriter();w.add_blank_page(width=100,height=100);b=io.BytesIO();w.write(b);sys.stdout.buffer.write(b.getvalue())",
  ]);
  const pdf = await ok(`groups/${group}/documents/uploads`, "POST", {
    title: "QA blank PDF",
    filename: "fixture.pdf",
    mime: "application/pdf",
    size: payload.length,
  });
  const resume = await ok(
    `groups/${group}/documents/${pdf.document.id}/upload-url`,
    "POST",
    {},
  );
  assert.equal(resume.document.id, pdf.document.id);
  const put = await fetch(resume.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: payload,
  });
  assert(put.ok, `Storage PUT ${put.status}`);
  await ok(`groups/${group}/documents/${pdf.document.id}/complete`, "POST", {});
  const failed = await waitDoc(pdf.document.id, "failed");
  assert.equal(failed.error_code, "NO_TEXT_OCR_UNSUPPORTED");
  assert.equal(failed.upload_completed, true);
  await ok(`groups/${group}/documents/${pdf.document.id}`, "DELETE");
  const deletion = sql(
    "select kind,status from document_jobs where group_id=%s and document_id=%s and kind='delete'",
    [group, pdf.document.id],
  );
  assert.equal(deletion[0][0], "delete");
  assert.equal(deletion[0][1], "queued");
  sql(
    "update document_jobs set run_after=now() where group_id=%s and document_id=%s and kind='delete'",
    [group, pdf.document.id],
  );
  for (let n = 0; n < 20; n++) {
    if (
      sql(
        "select status from document_jobs where group_id=%s and document_id=%s and kind='delete'",
        [group, pdf.document.id],
      )[0][0] === "done"
    )
      break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    sql(
      "select status from document_jobs where group_id=%s and document_id=%s and kind='delete'",
      [group, pdf.document.id],
    )[0][0],
    "done",
  );
  console.log(
    "PASS: real signed upload resume, HEAD verification, OCR failure, durable Storage deletion",
  );
  const abandoned = await ok(`groups/${group}/documents/uploads`, "POST", {
    title: "QA abandoned",
    filename: "fixture.pdf",
    mime: "application/pdf",
    size: 1,
  });
  sql(
    "update documents set upload_expires_at=now()-interval '1 second' where group_id=%s and id=%s",
    [group, abandoned.document.id],
  );
  // The regular cleanup scheduler checks expiry every minute.
  for (let n = 0; n < 70; n++) {
    const state = await call(
      `groups/${group}/documents/${abandoned.document.id}`,
    );
    if (state.status === 404) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    (await call(`groups/${group}/documents/${abandoned.document.id}`)).status,
    404,
  );
  console.log("PASS: expired incomplete upload cleanup");
} finally {
  if (group && token) {
    await ok(`groups/${group}`, "DELETE");
    const paths = sql(
      "select storage_path from document_jobs where group_id=%s and kind='delete'",
      [group],
    ).map((row) => row[0]);
    if (paths.length) {
      const r = await fetch(url + "/storage/v1/object/group-documents", {
        method: "DELETE",
        headers: {
          apikey: secret,
          Authorization: "Bearer " + secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: paths }),
      });
      assert(r.ok, "Fixture file cleanup failed");
    }
    sql("delete from document_jobs where group_id=%s", [group]);
  }
  if (user) {
    sql("delete from audit_logs where actor_id=%s", [user]);
    await admin("users/" + user, "DELETE");
  }
  console.log("Temporary fixture metadata cleaned up");
}
