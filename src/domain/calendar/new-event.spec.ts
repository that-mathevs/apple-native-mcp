import { describe, expect, it } from "vitest";

import type { Occurrence } from "./event.js";
import { duplicateOf, rangeOf, timeFrom } from "./new-event.js";

const lunch: Occurrence = {
  identifier: "event-1",
  title: "Lunch with Sam",
  start: new Date("2026-09-22T16:30:00Z"),
  end: new Date("2026-09-22T17:30:00Z"),
  isAllDay: false,
  calendar: { identifier: "cal-1", title: "Work", account: "iCloud", acceptsNewEvents: true },
};

const the22nd = { year: 2026, month: 9, day: 22 };
const the24th = { year: 2026, month: 9, day: 24 };

describe("a new event's time", () => {
  it("given a start with no end, refuses: an event with no end has no length to guess", () => {
    expect(timeFrom({ start: lunch.start })).toMatchObject({
      ok: false,
      failure: { code: "event-time-invalid" },
    });
  });

  it("given a last day before the first day, refuses rather than swapping them", () => {
    expect(timeFrom({ firstDay: the24th, lastDay: the22nd })).toMatchObject({ ok: false });
  });

  it("given a last day and no first day, refuses: there is nothing for it to be the last of", () => {
    expect(timeFrom({ lastDay: the24th })).toMatchObject({ ok: false });
  });

  // An all-day event in New York on the day the clocks go back is 25 hours long.
  it("given an all-day event, covers whole days in the user's time zone, however many hours those days have", () => {
    const range = rangeOf(
      {
        kind: "allDay",
        firstDay: { year: 2026, month: 11, day: 1 },
        lastDay: { year: 2026, month: 11, day: 1 },
      },
      "America/New_York",
    );

    expect(range).toStrictEqual({
      from: new Date("2026-11-01T04:00:00Z"),
      to: new Date("2026-11-02T05:00:00Z"),
    });
  });
});

describe("a duplicate event", () => {
  const during = { from: new Date("2026-09-22T17:00:00Z"), to: new Date("2026-09-22T18:00:00Z") };

  it("given the same title overlapping only in part, is a duplicate: overlapping is enough", () => {
    expect(duplicateOf("Lunch with Sam", during, [lunch])).toBe(lunch);
  });

  it("given an event that ends exactly when the new one starts, is not a duplicate: back to back is not overlapping", () => {
    const after = { from: lunch.end, to: new Date("2026-09-22T18:30:00Z") };

    expect(duplicateOf("Lunch with Sam", after, [lunch])).toBeUndefined();
  });

  it("given another title at the same time, is not a duplicate", () => {
    expect(duplicateOf("Dentist", during, [lunch])).toBeUndefined();
  });
});
