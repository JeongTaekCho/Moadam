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
): Promise<T> {
  const requestScope = scope;
  const group = path.match(/^groups\/([^/?]+)/)?.[1];
  if (group && scope && group !== scope)
    throw new DOMException("Stale group request", "AbortError");
  const response = await fetch("/api/proxy/" + path, {
    signal: group ? controller.signal : undefined,
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (group && requestScope !== scope)
    throw new DOMException("Stale group response", "AbortError");
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.message || "요청을 처리하지 못했습니다",
    );
  return data as T;
}
