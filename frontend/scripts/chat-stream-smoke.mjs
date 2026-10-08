import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), "moadam-stream-"));
let next;
const backend = createServer();
try {
  for (const name of ["request-cache", "client", "chat-stream"]) {
    const source = await readFile(
      new URL(`../src/shared/api/${name}.ts`, import.meta.url),
      "utf8",
    );
    await writeFile(
      join(directory, `${name}.js`),
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    );
  }
  const { consumeChatStream } = require(join(directory, "chat-stream.js"));
  const answer = "한글이 깨지지 않는 답변 😀\n두 번째 줄";
  const done = {
    type: "done",
    user: { id: "user" },
    assistant: { id: "assistant", content: answer },
  };
  const lines = [{ type: "delta", text: answer }, done]
    .map((e) => JSON.stringify(e) + "\n")
    .join("");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(lines);
  let index = 0,
    text = "";
  await consumeChatStream(
    new ReadableStream({
      pull(controller) {
        if (index === bytes.length) controller.close();
        else controller.enqueue(bytes.slice(index, ++index));
      },
    }),
    (event) => {
      if (event.type === "delta") text += event.text;
    },
  );
  assert.equal(text, answer);
  const closed = (value) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(value));
        controller.close();
      },
    });
  await assert.rejects(
    consumeChatStream(closed('{"type":"delta","text":"중간"}\n'), () => {}),
    /끊어졌습니다/,
  );
  await assert.rejects(
    consumeChatStream(closed('{"type":"error","message":"오류"}\n'), () => {}),
    /오류/,
  );
  const abort = new AbortController();
  const waiting = consumeChatStream(
    new ReadableStream({ start() {} }),
    () => {},
    abort.signal,
  );
  abort.abort();
  await assert.rejects(waiting, { name: "AbortError" });

  let finished = false,
    cancelled = false;
  backend.on("request", (req, res) => {
    req.resume();
    if (req.url?.includes("cancel")) {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write('{"type":"status","stage":"generating"}\n');
      res.on("close", () => {
        cancelled = true;
      });
      return;
    }
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write('{"type":"status","stage":"generating"}\n');
    const delta = setTimeout(
      () => res.write(JSON.stringify({ type: "delta", text: answer }) + "\n"),
      100,
    );
    const finish = setTimeout(() => {
      finished = true;
      res.end(JSON.stringify(done) + "\n");
    }, 1000);
    res.on("close", () => {
      clearTimeout(delta);
      clearTimeout(finish);
    });
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const origin = `http://localhost:${port}`;
  next = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", String(port)],
    {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        BACKEND_URL: `http://127.0.0.1:${backend.address().port}`,
      },
      stdio: "ignore",
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${origin}/api/proxy/me`, {
        signal: AbortSignal.timeout(500),
      });
      if (r.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Production Next server ready");
  const path = `${origin}/api/proxy/groups/g/chat/sessions/s/messages/stream`;
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: "access=test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: "검증" }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  let sawDelta = false;
  await consumeChatStream(response.body, (event) => {
    if (event.type === "delta") {
      assert(!finished, "BFF must forward delta before upstream completion");
      sawDelta = true;
    }
  });
  assert(sawDelta);
  const controller = new AbortController();
  const cancellable = await fetch(`${origin}/api/proxy/cancel`, {
    headers: { Cookie: "access=test-token" },
    signal: controller.signal,
  });
  await cancellable.body.getReader().read();
  controller.abort();
  for (let i = 0; i < 30 && !cancelled; i++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert(cancelled, "Client cancellation closes upstream stream");
  console.log(
    "Chat stream checks passed: split UTF-8, truncation/errors, abort, live BFF forwarding before completion and cancellation.",
  );
} finally {
  next?.kill("SIGTERM");
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
