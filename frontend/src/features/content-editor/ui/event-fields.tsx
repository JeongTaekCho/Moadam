"use client";
import { useState } from "react";
import type { Event } from "@/entities/event";
import {
  eventDateRange,
  isAllDayEvent,
  buildEventTimeRange,
} from "@/entities/event/schedule";
import { koreaDateKey, localInput } from "@/shared/lib/form";
import { DatePicker, TimePicker, TextField, Textarea, Icon } from "@/shared/ui";

export function EventFields({
  event,
  initialDate,
  busy,
}: {
  event?: Event;
  initialDate?: string;
  busy: boolean;
}) {
  const today = koreaDateKey(new Date());
  const range = event
    ? eventDateRange(event)
    : { start: initialDate || "", end: initialDate || "" };
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [sameDay, setSameDay] = useState(range.start === range.end);
  const timed = !!event && !isAllDayEvent(event);
  const [withTime, setWithTime] = useState(timed);
  const [startTime, setStartTime] = useState(
    timed ? localInput(event.starts_at).slice(11) : "09:00",
  );
  const [endTime, setEndTime] = useState(
    timed ? localInput(event.ends_at).slice(11) : "10:00",
  );
  const effectiveEnd = sameDay ? startDate : endDate;
  let timestamps = { starts_at: "", ends_at: "" };
  let error = "";
  if (startDate && effectiveEnd) {
    try {
      if (startDate < today)
        throw new Error("오늘 이전 날짜로 일정을 만들 수 없습니다");
      timestamps = buildEventTimeRange(
        startDate,
        effectiveEnd,
        withTime,
        startTime,
        endTime,
      );
    } catch (reason) {
      error =
        reason instanceof Error ? reason.message : "일정 기간을 확인해 주세요";
    }
  }
  return (
    <div className="event-editor-fields">
      <fieldset className="event-date-fields" disabled={busy}>
        <legend>
          <Icon name="calendar" size={18} /> 날짜를 먼저 선택해 주세요
        </legend>
        <div className="event-date-inputs">
          <DatePicker
            label="시작일"
            minDate={today}
            value={startDate}
            onChange={(date) => {
              setStartDate(date);
              if (date > endDate) setEndDate(date);
            }}
            required
            disabled={busy}
          />
          <DatePicker
            label="종료일"
            minDate={startDate > today ? startDate : today}
            value={effectiveEnd}
            onChange={setEndDate}
            required
            disabled={sameDay || busy}
          />
        </div>
        <div className="event-options">
          <label>
            <input
              type="checkbox"
              checked={sameDay}
              onChange={(event) => setSameDay(event.target.checked)}
            />
            시작일과 종료일이 같음
          </label>
          <label>
            <input
              type="checkbox"
              checked={withTime}
              onChange={(event) => setWithTime(event.target.checked)}
            />
            시간 추가
          </label>
        </div>
        <div className={`event-time-inputs ${withTime ? "" : "time-disabled"}`}>
          <TimePicker
            label="시작 시간"
            value={startTime}
            onChange={setStartTime}
            disabled={!withTime || busy}
          />
          <TimePicker
            label="종료 시간"
            value={endTime}
            onChange={setEndTime}
            disabled={!withTime || busy}
          />
        </div>
        <p className="form-hint">
          {withTime
            ? "선택한 시간에 맞춰 진행되는 일정이에요. 한국 시간 기준으로 표시됩니다."
            : "시간 없이 선택한 날짜 전체에 표시되는 일정이에요."}
        </p>
        {error && (
          <p className="event-date-error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <input type="hidden" name="starts_at" value={timestamps.starts_at} />
      <input type="hidden" name="ends_at" value={timestamps.ends_at} />
      <TextField
        label="일정 제목"
        name="title"
        defaultValue={event?.title}
        maxLength={200}
        required
        disabled={busy}
      />
      <TextField
        label="장소"
        name="location"
        defaultValue={event?.location}
        maxLength={500}
        placeholder="어디에서 만나나요?"
        disabled={busy}
      />
      <Textarea
        label="설명"
        name="description"
        defaultValue={event?.description}
        maxLength={10000}
        placeholder="함께 준비할 내용이나 안내를 남겨 주세요."
        disabled={busy}
      />
    </div>
  );
}
