import { NextRequest, NextResponse } from "next/server";
export function failure(status: number, message: string) {
  return NextResponse.json(
    { code: `HTTP_${status}`, message, requestId: crypto.randomUUID() },
    { status },
  );
}
export async function limitedBody(
  req: NextRequest,
  limit = 1048576,
): Promise<string> {
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new RangeError("Request too large");
  const reader = req.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new RangeError("Request too large");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
