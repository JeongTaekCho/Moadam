import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const url = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(source, {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    }),
  ).toString("base64");
const form = url(await readFile("src/shared/lib/form.ts", "utf8"));
const source = (
  await readFile("src/entities/event/schedule.ts", "utf8")
).replace('"@/shared/lib/form"', JSON.stringify(form));
const {
  buildEventTimeRange,
  eventDateRange,
  calendarLayout,
  isAllDayEvent,
  isPastEventStart,
  addDateDays,
} = await import(url(source));
assert.deepEqual(
  buildEventTimeRange("2026-10-12", "2026-10-12", false, "09:00", "10:00"),
  { starts_at: "2026-10-12T00:00", ends_at: "2026-10-13T00:00" },
);
assert.deepEqual(
  buildEventTimeRange("2026-12-30", "2027-01-02", false, "", ""),
  { starts_at: "2026-12-30T00:00", ends_at: "2027-01-03T00:00" },
);
for (const args of [
  ["2026-02-30", "2026-03-01", false, "", ""],
  ["2026-10-12", "2026-10-11", false, "", ""],
  ["2026-10-12", "2026-10-12", true, "10:00", "09:00"],
  ["2026-10-12", "2026-10-12", true, "25:00", "26:00"],
])
  assert.throws(() => buildEventTimeRange(...args));
const event = (id, start, end) => ({
  id,
  title: id,
  starts_at: start + "T00:00:00+09:00",
  ends_at: addDateDays(end, 1) + "T00:00:00+09:00",
});
const span = event("span", "2026-09-30", "2026-10-06");
assert.equal(isAllDayEvent(span), true);
assert.deepEqual(eventDateRange(span), {
  start: "2026-09-30",
  end: "2026-10-06",
});
assert.deepEqual(
  eventDateRange({
    starts_at: "2026-10-12T09:00:00+09:00",
    ends_at: "2026-10-13T00:00:00+09:00",
  }),
  { start: "2026-10-12", end: "2026-10-12" },
);
const layout = calendarLayout(
  [
    span,
    event("overlap", "2026-10-01", "2026-10-04"),
    event("third", "2026-10-02", "2026-10-04"),
    event("hidden", "2026-10-03", "2026-10-04"),
  ],
  "2026-10",
);
assert.equal(layout.start, "2026-09-27");
assert.equal(layout.laneCount, 3);
assert.equal(layout.lanes.length, 4);
const segments = layout.weeks
  .flat()
  .filter((range) => range.event.id === "span");
assert.equal(segments.length, 2);
assert.equal(segments[0].span, 4);
assert.equal(segments[1].span, 3);
assert.equal(segments[0].lane, segments[1].lane);
assert.equal(segments[1].startsHere, false);
assert.equal(segments[1].endsHere, true);
assert.equal(
  calendarLayout([event("outside", "2026-12-01", "2026-12-02")], "2026-10")
    .lanes.length,
  0,
);
console.log(
  "PASS: one-day/multiple-day intervals, midnight exclusive end, invalid dates/times, week/month/year boundaries, overlapping lanes and overflow",
);

const now = new Date("2026-10-11T15:00:00Z");
assert.equal(
  isPastEventStart({ starts_at: "2026-10-11T14:59:59Z" }, now),
  true,
);
assert.equal(
  isPastEventStart({ starts_at: "2026-10-11T15:00:00Z" }, now),
  false,
);
assert.equal(
  isPastEventStart(
    { starts_at: "2026-10-11T15:00:00Z" },
    new Date("2026-10-12T14:59:59Z"),
  ),
  false,
);
assert.equal(
  isPastEventStart(
    { starts_at: "2026-10-11T15:00:00Z" },
    new Date("2026-10-12T15:00:00Z"),
  ),
  true,
);
console.log(
  "PASS: Korean date-based attendance cutoff, today allowed even after the start time",
);
