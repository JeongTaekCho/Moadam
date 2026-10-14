"use client";
import { useId, useState, type CSSProperties } from "react";

export function GroupCapacityField({
  defaultValue = 30,
  memberCount = 1,
  disabled = false,
}: {
  defaultValue?: number;
  memberCount?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const minimum = Math.max(1, memberCount);
  const [value, setValue] = useState(String(defaultValue));
  const selected = Math.min(30, Math.max(minimum, Number(value) || minimum));
  const progress =
    minimum === 30 ? 100 : ((selected - minimum) / (30 - minimum)) * 100;
  return (
    <fieldset className="group-capacity" disabled={disabled}>
      <legend>모임 최대 인원</legend>
      <div className="group-capacity-heading">
        <div>
          <p className="group-capacity-caption">함께할 인원을 정해 주세요</p>
          <p className="group-capacity-description">
            소유자를 포함해 최대 30명까지
          </p>
        </div>
        <div className="group-capacity-number">
          <input
            id={`${id}-number`}
            aria-label="모임 최대 인원 숫자 입력"
            aria-describedby={`${id}-hint`}
            name="max_members"
            type="number"
            inputMode="numeric"
            min={minimum}
            max={30}
            step={1}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setValue(String(Math.round(selected)))}
          />
          <span aria-hidden="true">명</span>
        </div>
      </div>
      <input
        className="group-capacity-slider"
        aria-label="모임 최대 인원 슬라이더"
        aria-describedby={`${id}-hint`}
        aria-valuetext={`${selected}명`}
        type="range"
        min={minimum}
        max={30}
        step={1}
        value={selected}
        onChange={(event) => setValue(event.target.value)}
        style={{ "--capacity-progress": `${progress}%` } as CSSProperties}
      />
      <div className="group-capacity-scale" aria-hidden="true">
        <span>{minimum}명</span>
        <span>30명</span>
      </div>
      <p id={`${id}-hint`} className="group-capacity-hint">
        {memberCount > 1
          ? `현재 ${memberCount}명 참여 중 · 참여 인원보다 작게 설정할 수 없어요.`
          : "슬라이더를 움직이거나 숫자를 직접 입력하세요. 나중에 설정에서 변경할 수 있어요."}
      </p>
    </fieldset>
  );
}
