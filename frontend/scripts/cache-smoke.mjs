import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const moduleUrl = (code) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(code, {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    }),
  ).toString("base64");
const cacheUrl = moduleUrl(
  await readFile("src/shared/api/request-cache.ts", "utf8"),
);
const { RequestCache } = await import(cacheUrl);
let calls = 0;
const cache = new RequestCache(2);
const load = async () => ({ count: ++calls });
const [one, two] = await Promise.all([
  cache.get("same", 1000, load),
  cache.get("same", 1000, load),
]);
assert.equal(calls, 1);
one.count = 100;
assert.equal(two.count, 1);
assert.equal((await cache.get("same", 1000, load)).count, 1);
cache.invalidate();
await cache.get("same", 1000, load);
assert.equal(calls, 2);
const oldNow = Date.now;
let now = oldNow();
Date.now = () => now;
await cache.get("expires", 10, load);
now += 11;
await cache.get("expires", 10, load);
assert.equal(calls, 4);
Date.now = oldNow;
await cache.get("a", 1000, load);
await cache.get("b", 1000, load);
await cache.get("a", 1000, load);
const before = calls;
await cache.get("expires", 1000, load);
assert.equal(calls, before + 1);
let resolve;
const slow = () =>
  new Promise((r) => {
    resolve = r;
  });
const consumer = new AbortController();
const cancelled = cache.get("shared", 1000, slow, consumer.signal);
const retained = cache.get("shared", 1000, slow);
await Promise.resolve();
consumer.abort();
resolve({ ok: true });
await assert.rejects(cancelled, { name: "AbortError" });
assert.deepEqual(await retained, { ok: true });
const invalid = cache.get("invalid", 1000, slow);
await Promise.resolve();
cache.invalidate();
resolve({ ok: true });
await assert.rejects(invalid, { name: "AbortError" });
let attempts = 0;
const retry = () => {
  if (++attempts === 1) throw new Error("503");
  return { ok: true };
};
await assert.rejects(cache.get("retry", 1000, retry));
assert.deepEqual(await cache.get("retry", 1000, retry), { ok: true });
const clientSource = (
  await readFile("src/shared/api/client.ts", "utf8")
).replace('"./request-cache"', JSON.stringify(cacheUrl));
const { api, setApiScope, clearApiSession } = await import(
  moduleUrl(clientSource)
);
let network = 0,
  serverValue = "before";
let fail401 = false;
globalThis.fetch = async () => {
  network++;
  return Response.json({ value: serverValue }, { status: fail401 ? 401 : 200 });
};
setApiScope("alpha");
await Promise.all([api("groups/alpha/posts"), api("groups/alpha/posts")]);
assert.equal(network, 1);
await api("groups/alpha/posts");
assert.equal(network, 1);
serverValue = "after";
await api("groups/alpha/posts", "POST", {});
assert.equal((await api("groups/alpha/posts")).value, "after");
assert.equal(network, 3);
await api("me");
await api("me");
assert.equal(network, 5);
await api("groups/alpha/documents/id/download");
await api("groups/alpha/documents/id/download");
assert.equal(network, 7);
setApiScope("beta");
await assert.rejects(api("groups/alpha/posts"), { name: "AbortError" });
clearApiSession();
await api("groups/alpha/posts");
assert.equal(network, 8);
fail401 = true;
await assert.rejects(api("me"), { status: 401 });
fail401 = false;
await api("groups/alpha/posts");
assert.equal(network, 10);
console.log(
  "PASS: deduplication, TTL, bounds, isolated copies, mutation invalidation, consumer cancellation, stale response cancellation, errors, session reset, group isolation and uncached auth/signed URLs",
);
