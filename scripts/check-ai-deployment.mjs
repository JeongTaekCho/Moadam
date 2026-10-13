// Read-only readiness checks. Pass the actual trusted RAG service URL via RAG_URL.
const base = process.env.RAG_URL?.trim().replace(/\/+$/, "");
const token = process.env.RAG_INTERNAL_TOKEN;
if (!base || !token) {
  console.error("RAG_URL과 RAG_INTERNAL_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}
const url = new URL(base);
if (
  !["http:", "https:"].includes(url.protocol) ||
  url.username ||
  url.password
) {
  console.error("RAG_URL은 인증정보가 없는 HTTP/HTTPS 서비스 주소여야 합니다.");
  process.exit(1);
}
if (
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
  process.env.AI_CHECK_ALLOW_LOCAL !== "1"
) {
  console.error(
    "배포된 별도 RAG 서비스 주소를 지정하세요. localhost는 현재 실행 머신을 가리킵니다.",
  );
  process.exit(1);
}
for (const path of ["health", "ready"]) {
  try {
    const response = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403
          ? "AI_AUTH_FAILED"
          : response.status === 404
            ? "AI_ENDPOINT_MISSING"
            : "AI_UPSTREAM_UNAVAILABLE";
      console.error(
        JSON.stringify({ check: path, status: response.status, code }),
      );
      process.exitCode = 1;
      continue;
    }
    const result = await response.json();
    if (path === "ready" && result.generation_available !== true) {
      console.error(
        JSON.stringify({ check: path, code: "AI_PROVIDER_DISABLED" }),
      );
      process.exitCode = 1;
    } else
      console.log(
        JSON.stringify({ check: path, status: response.status, ready: true }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        check: path,
        code:
          error.name === "TimeoutError" ? "AI_TIMEOUT" : "AI_CONNECTION_FAILED",
      }),
    );
    process.exitCode = 1;
  }
}
