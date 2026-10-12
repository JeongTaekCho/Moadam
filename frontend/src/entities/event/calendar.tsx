"use client";
import ReactCalendar from "react-calendar";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { Event } from "./model";
import {
  addDateDays,
  calendarDate,
  calendarDateKey,
  calendarLayout,
  formatEventRange,
} from "./schedule";
import { koreaDateKey } from "@/shared/lib/form";

export function Calendar({
  events,
  month,
  selectedDay,
  onSelectDay,
  onOpen,
  onCreate,
}: {
  events: Event[];
  month: Date;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onOpen: (event: Event) => void;
  onCreate: (day: string) => void;
}) {
  const monthKey = koreaDateKey(month).slice(0, 7);
  const layout = useMemo(
    () => calendarLayout(events, monthKey),
    [events, monthKey],
  );
  const today = koreaDateKey(new Date());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const days = Array.from({ length: 42 }, (_, index) =>
    addDateDays(layout.start, index),
  );
  return (
    <div
      className="schedule-calendar"
      aria-label="월간 일정 달력"
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const row = Math.floor(
          (event.clientY - bounds.top - 40) / ((bounds.height - 40) / 6),
        );
        const column = Math.floor(
          ((event.clientX - bounds.left) / bounds.width) * 7,
        );
        setHoveredDay(
          row >= 0 && row < 6 && column >= 0 && column < 7
            ? days[row * 7 + column]
            : null,
        );
      }}
      onPointerLeave={() => setHoveredDay(null)}
      onFocusCapture={(event) => {
        const button = event.target.closest("button");
        setFocusedDay(
          button?.dataset.calendarDay ??
            button?.querySelector<HTMLElement>("[data-calendar-day]")?.dataset
              .calendarDay ??
            null,
        );
      }}
      onBlurCapture={() => setFocusedDay(null)}
      style={{ "--calendar-lanes": layout.laneCount } as CSSProperties}
    >
      <ReactCalendar
        locale="ko-KR"
        calendarType="gregory"
        view="month"
        minDetail="month"
        maxDetail="month"
        showNavigation={false}
        showFixedNumberOfWeeks
        showNeighboringMonth
        activeStartDate={calendarDate(`${monthKey}-01`)}
        value={calendarDate(selectedDay)}
        onClickDay={(date) => onSelectDay(calendarDateKey(date))}
        formatDay={(_, date) => String(date.getDate())}
        formatShortWeekday={(_, date) =>
          ["일", "월", "화", "수", "목", "금", "토"][date.getDay()]
        }
        formatLongDate={(_, date) =>
          `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
        }
        tileClassName={({ date }) =>
          calendarDateKey(date) === today ? "schedule-today" : null
        }
        tileContent={({ date }) => {
          const key = calendarDateKey(date);
          const hidden = layout.lanes.filter(
            (range) =>
              range.lane >= 3 && range.start <= key && range.end >= key,
          ).length;
          return (
            <>
              <span hidden data-calendar-day={key} />
              {hidden > 0 && <span className="schedule-more">+{hidden}개</span>}
            </>
          );
        }}
      />
      <div className="schedule-day-actions">
        {days.map((day) => (
          <div className="schedule-day-action" key={day}>
            {day >= today && (
              <button
                type="button"
                data-calendar-day={day}
                className={`schedule-create ${hoveredDay === day || focusedDay === day ? "is-visible" : ""} ${selectedDay === day ? "is-selected" : ""}`}
                aria-label={`${day} 새 일정`}
                onClick={() => {
                  if (day >= koreaDateKey(new Date())) onCreate(day);
                }}
              >
                새 일정
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="schedule-ribbons">
        {layout.weeks.map((segments, week) => (
          <div className="schedule-week" key={week}>
            {segments.map((segment) => (
              <button
                type="button"
                key={segment.event.id}
                className={`schedule-ribbon ribbon-tone-${segment.lane % 3} ${segment.startsHere ? "ribbon-start" : "ribbon-continued"} ${segment.endsHere ? "ribbon-end" : ""}`}
                style={{
                  gridColumn: `${segment.column} / span ${segment.span}`,
                  gridRow: segment.lane + 1,
                }}
                aria-label={`${segment.event.title}, ${formatEventRange(segment.event)}`}
                title={`${segment.event.title} · ${formatEventRange(segment.event)}`}
                onClick={() => onOpen(segment.event)}
              >
                <span>{segment.event.title}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
