// Read-only availability checks; no model calls, writes or credentials printed.
const backend = process.env.HEALTH_BACKEND_URL || "http://localhost:8080";
for (const path of ["/healthz", "/readyz"]) {
  const start = Date.now();
  try {
    const response = await fetch(new URL(path, backend), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    console.log(
      JSON.stringify({
        check: path,
        status: response.status,
        result: data?.status || "unknown",
        elapsedMs: Date.now() - start,
      }),
    );
    if (!response.ok || !data?.status) process.exitCode = 1;
  } catch (error) {
    console.log(
      JSON.stringify({
        check: path,
        result: "unavailable",
        error: error.name,
        elapsedMs: Date.now() - start,
      }),
    );
    process.exitCode = 1;
  }
}
