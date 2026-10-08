"use client";
import type { Event } from "./model";

import { Card, UserIdentity } from "@/shared/ui";
import { koreaDateKey, koreaDateParts } from "@/shared/lib/form";
const KOREA_TIME_ZONE = "Asia/Seoul";
export function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: KOREA_TIME_ZONE,
  }).format(new Date(value));
}
export function EventCard({
  event,
  onOpen,
}: {
  event: Event;
  onOpen: () => void;
}) {
  const date = new Date(event.starts_at);
  return (
    <Card className="event-card">
      <div className="date-tile">
        <small>
          {new Intl.DateTimeFormat("ko-KR", {
            month: "short",
            timeZone: KOREA_TIME_ZONE,
          }).format(date)}
        </small>
        <strong>
          {new Intl.DateTimeFormat("ko-KR", {
            day: "numeric",
            timeZone: KOREA_TIME_ZONE,
          })
            .format(date)
            .replace("일", "")}
        </strong>
      </div>
      <div>
        <button className="post-title" onClick={onOpen}>
          {event.title}
        </button>
        <p>{formatTime(event.starts_at)}</p>
        <small>{event.location || "장소 미정"}</small>
        <UserIdentity
          profile={event.author}
          id={event.author_id}
          label="등록자"
        />
      </div>
    </Card>
  );
}
export function Calendar({
  events,
  month,
  onOpen,
}: {
  events: Event[];
  month: Date;
  onOpen: (event: Event) => void;
}) {
  const monthParts = koreaDateParts(month);
  const y = Number(monthParts.year),
    m = Number(monthParts.month) - 1;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const offset = new Date(Date.UTC(y, m, 1, -9)).getUTCDay();
  return (
    <div className="calendar" aria-label="월간 일정 달력">
      {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
        <strong key={d}>{d}</strong>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <div key={"blank" + i} />
      ))}
      {Array.from({ length: days }, (_, i) => (
        <div className="day" key={i}>
          {i + 1}
          {events
            .filter(
              (e) =>
                koreaDateKey(new Date(e.starts_at)) ===
                `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
            )
            .map((e) => (
              <button className="dot" key={e.id} onClick={() => onOpen(e)}>
                {e.title}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
