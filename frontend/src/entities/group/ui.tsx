"use client";
import type { Group } from "./model";

import { CustomSelect } from "@/shared/ui";
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
    <CustomSelect
      label="현재 모임"
      icon="people"
      value={current}
      onChange={onChange}
      options={groups.map((g) => ({ value: g.id, label: g.name }))}
    />
  );
}
