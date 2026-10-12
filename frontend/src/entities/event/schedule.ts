import type { Event } from "./model";
import {
  koreaDateKey,
  localInput,
  koreaLocalInputToUtc,
} from "@/shared/lib/form";

export function addDateDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function isAllDayEvent(event: Pick<Event, "starts_at" | "ends_at">) {
  return (
    localInput(event.starts_at).endsWith("T00:00") &&
    localInput(event.ends_at).endsWith("T00:00") &&
    new Date(event.starts_at).getTime() % 60000 === 0 &&
    new Date(event.ends_at).getTime() % 60000 === 0
  );
}
export function eventDateRange(event: Pick<Event, "starts_at" | "ends_at">) {
  return {
    start: koreaDateKey(new Date(event.starts_at)),
    // Half-open intervals: midnight belongs to the previous occupied date.
    end: koreaDateKey(new Date(new Date(event.ends_at).getTime() - 1)),
  };
}
export function formatEventRange(event: Pick<Event, "starts_at" | "ends_at">) {
  const range = eventDateRange(event);
  const date = (key: string) =>
    new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${key}T12:00:00Z`));
  if (isAllDayEvent(event))
    return `${date(range.start)}${range.start === range.end ? "" : ` – ${date(range.end)}`} · 하루 종일`;
  const clock = (iso: string) =>
    new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Seoul",
    }).format(new Date(iso));
  const endDate = koreaDateKey(new Date(event.ends_at));
  return `${date(range.start)} ${clock(event.starts_at)} – ${range.start === endDate ? "" : `${date(endDate)} `}${clock(event.ends_at)}`;
}
function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function buildEventTimeRange(
  start: string,
  end: string,
  withTime: boolean,
  startTime: string,
  endTime: string,
) {
  if (!validDate(start) || !validDate(end))
    throw new Error("시작일과 종료일을 선택해 주세요");
  if (end < start) throw new Error("종료일은 시작일보다 빠를 수 없습니다");
  if (
    withTime &&
    (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime))
  )
    throw new Error("시작 시간과 종료 시간을 확인해 주세요");
  const starts_at = `${start}T${withTime ? startTime : "00:00"}`;
  const ends_at = `${withTime ? end : addDateDays(end, 1)}T${withTime ? endTime : "00:00"}`;
  if (koreaLocalInputToUtc(ends_at) <= koreaLocalInputToUtc(starts_at))
    throw new Error("종료 시간은 시작 시간보다 늦어야 합니다");
  return { starts_at, ends_at };
}
export function calendarDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function calendarLayout(events: Event[], monthKey: string) {
  const first = `${monthKey}-01`;
  const start = addDateDays(first, -new Date(`${first}T12:00:00Z`).getUTCDay());
  const last = addDateDays(start, 41);
  const laneEnds: string[] = [];
  const ranges = events
    .map((event) => ({ event, ...eventDateRange(event) }))
    .filter((range) => range.start <= last && range.end >= start)
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        b.end.localeCompare(a.end) ||
        a.event.id.localeCompare(b.event.id),
    );
  const lanes = ranges.map((range) => {
    let lane = laneEnds.findIndex((end) => end < range.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = range.end;
    return { ...range, lane };
  });
  const weeks = Array.from({ length: 6 }, (_, week) => {
    const weekStart = addDateDays(start, week * 7),
      weekEnd = addDateDays(weekStart, 6);
    return lanes
      .filter(
        (range) =>
          range.start <= weekEnd && range.end >= weekStart && range.lane < 3,
      )
      .map((range) => {
        const segmentStart = range.start < weekStart ? weekStart : range.start;
        const segmentEnd = range.end > weekEnd ? weekEnd : range.end;
        const index = (key: string) =>
          Math.round(
            (new Date(`${key}T12:00:00Z`).getTime() -
              new Date(`${weekStart}T12:00:00Z`).getTime()) /
              86400000,
          );
        return {
          ...range,
          column: index(segmentStart) + 1,
          span: index(segmentEnd) - index(segmentStart) + 1,
          startsHere: segmentStart === range.start,
          endsHere: segmentEnd === range.end,
        };
      });
  });
  return {
    start,
    weeks,
    lanes,
    laneCount: Math.max(1, Math.min(3, laneEnds.length)),
  };
}

export function isPastEventStart(
  event: Pick<Event, "starts_at">,
  now = new Date(),
) {
  return koreaDateKey(new Date(event.starts_at)) < koreaDateKey(now);
}
