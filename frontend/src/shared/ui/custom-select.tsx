"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};
export function CustomSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  icon,
  placeholder = "선택해 주세요",
  name,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: IconName;
  placeholder?: string;
  name?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const selected = options.findIndex((option) => option.value === value);
  const unavailable = disabled || !options.length;
  function position() {
    if (!trigger.current || !popup.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    const upwards = below < 180 && above > below;
    const height = Math.min(300, Math.max(64, upwards ? above : below));
    Object.assign(popup.current.style, {
      width: `${width}px`,
      maxHeight: `${height}px`,
      left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
      top: upwards ? "auto" : `${rect.bottom + 6}px`,
      bottom: upwards ? `${window.innerHeight - rect.top + 6}px` : "auto",
    });
  }
  function close(restoreFocus = true) {
    popup.current?.hidePopover();
    if (restoreFocus) trigger.current?.focus();
  }
  function show(last = false) {
    if (unavailable) return;
    position();
    popup.current?.showPopover();
    const index = selected >= 0 ? selected : last ? options.length - 1 : 0;
    items.current[index]?.focus();
    items.current[index]?.scrollIntoView({ block: "nearest" });
    search.current = { text: "", time: 0 };
  }
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    if (unavailable) popup.current?.hidePopover();
  }, [unavailable]);
  return (
    <div className="field custom-select">
      <span id={`${id}-label`}>{label}</span>
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <button
        ref={trigger}
        type="button"
        className="custom-select-trigger"
        disabled={unavailable}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp");
          }
        }}
      >
        {icon && (
          <span className="custom-select-icon">
            <Icon name={icon} size={18} />
          </span>
        )}
        <span id={`${id}-value`} className="custom-select-value">
          {options[selected]?.label || placeholder}
        </span>
        <Icon name="chevron" size={16} className="custom-select-chevron" />
      </button>
      <div
        ref={popup}
        id={`${id}-list`}
        popover="auto"
        role="listbox"
        aria-labelledby={`${id}-label`}
        className="custom-select-popover"
        onToggle={(event) => setOpen(event.newState === "open")}
        onKeyDown={(event) => {
          const current = items.current.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          let next = -1;
          if (event.key === "ArrowDown") next = (current + 1) % options.length;
          else if (event.key === "ArrowUp")
            next = (current - 1 + options.length) % options.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = options.length - 1;
          else if (event.key === "Escape") {
            event.preventDefault();
            close();
          } else if (event.key === "Tab") close(false);
          else if (
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const now = Date.now();
            search.current = {
              text:
                (now - search.current.time < 700 ? search.current.text : "") +
                event.key.toLocaleLowerCase(),
              time: now,
            };
            next = options.findIndex((option) =>
              option.label.toLocaleLowerCase().startsWith(search.current.text),
            );
          }
          if (next >= 0) {
            event.preventDefault();
            items.current[next]?.focus();
            items.current[next]?.scrollIntoView({ block: "nearest" });
          }
        }}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => {
              items.current[index] = element;
            }}
            type="button"
            role="option"
            aria-selected={option.value === value}
            tabIndex={index === Math.max(0, selected) ? 0 : -1}
            className="custom-select-option"
            onClick={() => {
              close();
              if (option.value !== value) onChange(option.value);
            }}
          >
            <span>
              <span className="custom-select-option-label">{option.label}</span>
              {option.description && <small>{option.description}</small>}
            </span>
            {option.value === value && <Icon name="check" size={17} />}
          </button>
        ))}
      </div>
    </div>
  );
}
