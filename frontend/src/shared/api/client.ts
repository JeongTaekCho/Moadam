import { RequestCache } from "./request-cache";
import type { components } from "./generated-api";
export type PublicProfile = components["schemas"]["PublicProfile"];
export type MyProfile = components["schemas"]["MyProfile"];
export type MyActivity = components["schemas"]["MyActivity"];
export type Group = components["schemas"]["Group"];
export type Post = components["schemas"]["Post"];
export type Comment = components["schemas"]["Comment"];
export type Event = components["schemas"]["Event"];
export type Document = components["schemas"]["Document"];
export type Citation = components["schemas"]["Citation"];
export type Message = components["schemas"]["Message"];
export type Session = components["schemas"]["Session"];
export type Member = components["schemas"]["Member"];
export type Invite = components["schemas"]["Invite"];
export type Role = Group["role"];
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const requests = new RequestCache();
let sessionController = new AbortController();
export function invalidateApiCache() {
  requests.invalidate();
}
export function clearApiSession() {
  requests.invalidate();
  sessionController.abort();
  sessionController = new AbortController();
  controller.abort();
  controller = new AbortController();
  scope = "";
}
function cacheLifetime(path: string) {
  // Session validation, signed URLs and conversation messages stay fresh.
  if (
    path === "me" ||
    /\/(download[^/?]*|upload[^/?]*|avatar|attendance|messages)(\?|$|\/)/.test(
      path,
    )
  )
    return 0;
  if (path.split("?")[0].includes("/documents")) return 10000;
  if (path.startsWith("me/activity") || path.includes("/chat/sessions"))
    return 15000;
  return 30000;
}
let scope = "";
let controller = new AbortController();
export function setApiScope(group: string) {
  if (scope !== group) {
    controller.abort();
    controller = new AbortController();
    scope = group;
  }
}
export function getApiScope() {
  return scope;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const requestScope = scope;
  const group = path.match(/^groups\/([^/?]+)/)?.[1];
  if (group && scope && group !== scope)
    throw new DOMException("Stale group request", "AbortError");
  const sessionSignal = sessionController.signal;
  const groupSignal = group ? controller.signal : undefined;
  const request = async (sharedSignal?: AbortSignal): Promise<T> => {
    const response = await fetch("/api/proxy/" + path, {
      signal: AbortSignal.any([
        sessionSignal,
        ...(groupSignal ? [groupSignal] : []),
        ...(sharedSignal ? [sharedSignal] : []),
        ...(signal && method !== "GET" ? [signal] : []),
      ]),
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    sessionSignal.throwIfAborted();
    if (group && requestScope !== scope)
      throw new DOMException("Stale group response", "AbortError");
    if (!response.ok) {
      if (response.status === 401) clearApiSession();
      throw new ApiError(
        response.status,
        data.message || "요청을 처리하지 못했습니다",
      );
    }
    if (method !== "GET") invalidateApiCache();
    return data as T;
  };
  if (method === "GET") {
    const result = await requests.get<T>(
      path,
      cacheLifetime(path),
      request,
      signal,
    );
    sessionSignal.throwIfAborted();
    groupSignal?.throwIfAborted();
    signal?.throwIfAborted();
    return result;
  }
  return request();
}
