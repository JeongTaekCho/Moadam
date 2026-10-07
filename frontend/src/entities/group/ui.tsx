"use client";
import type { Group } from "./model";

import { Select } from "@/shared/ui";
export function GroupSwitcher({
  groups,
  current,
  onChange,
}: {
  groups: Group[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select
      label="현재 모임"
      value={current}
      onChange={(e) => onChange(e.target.value)}
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </Select>
  );
}
