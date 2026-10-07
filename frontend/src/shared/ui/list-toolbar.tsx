"use client";
import { Icon } from "./icon";
export function ListSearch({
  value,
  onChange,
  placeholder = "현재 목록에서 검색",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="list-search">
      <Icon name="search" size={17} />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function FilterChips({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="filter-chips" aria-label="목록 필터">
      {items.map((x) => (
        <button
          key={x.value}
          aria-pressed={value === x.value}
          className={value === x.value ? "active" : ""}
          onClick={() => onChange(x.value)}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}
