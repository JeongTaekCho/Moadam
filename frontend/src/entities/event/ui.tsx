"use client";
import type { Event } from "./model";

import { Card, UserIdentity } from "@/shared/ui";
import { formatEventRange } from "./schedule";
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
        <p>{formatEventRange(event)}</p>
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
