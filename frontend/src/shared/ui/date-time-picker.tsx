"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icon";
import { localInput } from "../lib/form";

type PickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
};
const datePattern = "[0-9]{4}-[0-9]{2}-[0-9]{2}";
const timePattern = "([01][0-9]|2[0-3]):[0-5][0-9]";
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && dateKey(date) === value ? date : null;
}

export function DatePicker({
  label,
  value,
  onChange,
  name,
  required,
  disabled,
}: PickerProps) {
  const id = useId();
  const popoverId = `${id}-calendar`;
  const today = localInput(new Date().toISOString()).slice(0, 10);
  const [month, setMonth] = useState(() =>
    (parseDate(value) ? value : today).slice(0, 7),
  );
  const [focusDay, setFocusDay] = useState("");
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const first = new Date(month + "-01T12:00:00Z");
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
  const preferredDay = focusDay || (parseDate(value) ? value : today);
  const tabbableDay = days.some((day) => dateKey(day) === preferredDay)
    ? preferredDay
    : `${month}-01`;
  useEffect(() => {
    input.current?.setCustomValidity(
      value && !parseDate(value)
        ? "올바른 날짜를 입력해 주세요 (예: 2026-10-08)."
        : "",
    );
  }, [value]);
  useEffect(() => {
    if (focusDay)
      popover.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
        ?.focus();
  }, [focusDay, month]);
  const moveMonth = (offset: number) => {
    const date = new Date(first);
    date.setUTCMonth(date.getUTCMonth() + offset);
    setMonth(dateKey(date).slice(0, 7));
  };
  const choose = (day: string) => {
    onChange(day);
    popover.current?.hidePopover();
    trigger.current?.focus();
  };
  return (
    <div className="field picker-field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="picker-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="picker-control">
        <input
          id={id}
          ref={input}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="YYYY-MM-DD"
          pattern={datePattern}
          maxLength={10}
          required={required}
          disabled={disabled}
          autoComplete="off"
          aria-label={`${label} (년-월-일)`}
        />
        <button
          ref={trigger}
          type="button"
          className="picker-trigger"
          disabled={disabled}
          popoverTarget={popoverId}
          aria-label={`${label} 달력 열기`}
          aria-haspopup="dialog"
          onClick={() => {
            setMonth((parseDate(value) ? value : today).slice(0, 7));
            setFocusDay("");
          }}
        >
          <Icon name="calendar" size={19} />
        </button>
      </div>
      <div
        id={popoverId}
        ref={popover}
        popover="auto"
        role="dialog"
        aria-label={`${label} 날짜 선택`}
        className="picker-popover calendar-picker"
      >
        <div className="picker-heading">
          <button
            type="button"
            className="picker-month-arrow"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
          >
            <Icon name="chevron" className="rotate-90" size={18} />
          </button>
          <strong aria-live="polite">
            {first.getUTCFullYear()}년 {first.getUTCMonth() + 1}월
          </strong>
          <button
            type="button"
            className="picker-month-arrow"
            onClick={() => moveMonth(1)}
            aria-label="다음 달"
          >
            <Icon name="chevron" className="-rotate-90" size={18} />
          </button>
        </div>
        <div className="picker-weekdays" aria-hidden="true">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="picker-days" role="group" aria-label="날짜">
          {days.map((date) => {
            const day = dateKey(date);
            return (
              <button
                key={day}
                type="button"
                data-day={day}
                className={`picker-day ${day.slice(0, 7) !== month ? "outside" : ""} ${day === today ? "today" : ""}`}
                aria-label={`${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`}
                aria-pressed={day === value}
                aria-current={day === today ? "date" : undefined}
                tabIndex={day === tabbableDay ? 0 : -1}
                onClick={() => choose(day)}
                onKeyDown={(event) => {
                  const offsets: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  if (!(event.key in offsets)) return;
                  event.preventDefault();
                  const target = new Date(date);
                  target.setUTCDate(target.getUTCDate() + offsets[event.key]);
                  const next = dateKey(target);
                  setFocusDay(next);
                  if (next.slice(0, 7) !== month) setMonth(next.slice(0, 7));
                }}
              >
                {date.getUTCDate()}
              </button>
            );
          })}
        </div>
        <div className="picker-footer">
          <span>방향키로 날짜 이동</span>
          <button type="button" onClick={() => choose(today)}>
            오늘
          </button>
        </div>
      </div>
    </div>
  );
}

export function TimePicker({
  label,
  value,
  onChange,
  name,
  required,
  disabled,
}: PickerProps) {
  const id = useId();
  const popoverId = `${id}-time`;
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [hour = "", minute = ""] = value.split(":");
  const validHour = /^(?:[01]\d|2[0-3])$/.test(hour) ? hour : "09";
  const validMinute = /^[0-5]\d$/.test(minute) ? minute : "00";
  return (
    <div className="field picker-field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="picker-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="picker-control">
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="HH:MM"
          pattern={timePattern}
          maxLength={5}
          required={required}
          disabled={disabled}
          autoComplete="off"
          aria-label={`${label} (24시간 시:분)`}
        />
        <button
          type="button"
          ref={trigger}
          className="picker-trigger"
          disabled={disabled}
          popoverTarget={popoverId}
          aria-label={`${label} 시간 선택 열기`}
          aria-haspopup="dialog"
        >
          <Icon name="clock" size={19} />
        </button>
      </div>
      <div
        id={popoverId}
        ref={popover}
        popover="auto"
        role="dialog"
        aria-label={`${label} 시간 선택`}
        className="picker-popover time-picker"
        onToggle={(event) => {
          if (event.newState !== "open") return;
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>("[aria-pressed='true']")
            .forEach((option) => option.scrollIntoView({ block: "nearest" }));
        }}
      >
        <div className="picker-heading">
          <strong>시간 선택</strong>
          <span>24시간 기준</span>
        </div>
        <div className="time-picker-columns">
          {[
            { label: "시", count: 24, selected: hour },
            { label: "분", count: 60, selected: minute },
          ].map((column, index) => (
            <div key={column.label}>
              <p className="time-column-label">{column.label}</p>
              <div
                className="time-options"
                role="group"
                aria-label={column.label}
              >
                {Array.from({ length: column.count }, (_, i) =>
                  String(i).padStart(2, "0"),
                ).map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={column.selected === option}
                    aria-label={`${option}${column.label}`}
                    onClick={() => {
                      onChange(
                        index === 0
                          ? `${option}:${validMinute}`
                          : `${validHour}:${option}`,
                      );
                      if (index === 1) {
                        popover.current?.hidePopover();
                        trigger.current?.focus();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                        return;
                      event.preventDefault();
                      const target =
                        event.key === "ArrowDown"
                          ? event.currentTarget.nextElementSibling
                          : event.currentTarget.previousElementSibling;
                      if (target instanceof HTMLButtonElement) target.focus();
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="picker-footer">
          <span>분 단위로 선택할 수 있어요</span>
          <button
            type="button"
            onClick={() => {
              onChange("09:00");
              popover.current?.hidePopover();
              trigger.current?.focus();
            }}
          >
            오전 9시
          </button>
        </div>
      </div>
    </div>
  );
}

export function DateTimePicker({
  label,
  name,
  defaultValue = "",
  required,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [date, setDate] = useState(defaultValue.split("T")[0] || "");
  const [time, setTime] = useState(
    defaultValue.split("T")[1]?.slice(0, 5) || "",
  );
  return (
    <fieldset className="datetime-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="datetime-picker-fields">
        <DatePicker
          label="날짜"
          value={date}
          onChange={setDate}
          required={required}
          disabled={disabled}
        />
        <TimePicker
          label="시간"
          value={time}
          onChange={setTime}
          required={required}
          disabled={disabled}
        />
      </div>
      <input
        type="hidden"
        name={name}
        value={date && time ? `${date}T${time}` : ""}
        disabled={disabled}
      />
    </fieldset>
  );
}
