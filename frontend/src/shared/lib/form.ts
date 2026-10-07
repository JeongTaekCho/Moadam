import type { FormEvent } from "react";
export function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<
    string,
    string
  >;
}

export function localInput(iso?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" ", "T");
}
export function koreaLocalInputToUtc(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error("일정 시간을 확인해 주세요");
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 9, +mi)).toISOString();
}
export function koreaDateParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
}
export function koreaMonthStart(date = new Date()) {
  const p = koreaDateParts(date);
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, 1, 3));
}
export function shiftKoreaMonth(date: Date, amount: number) {
  const p = koreaDateParts(date);
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1 + amount, 1, 3));
}
export function koreaDateKey(date: Date) {
  const p = koreaDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
