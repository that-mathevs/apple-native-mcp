import { describe, expect, it } from "vitest";

import { defaultRange, startOfDayIn, wholeDaysFrom } from "./range.js";

// Upstream searched "from now", so a meeting earlier today was missing and nothing said so,
// and two forks read the bounds as UTC dates, which lands on the wrong day west of Greenwich
// (findings CAL-C7). A range is whole local days, and the rules live here because they are
// the part that has to be right in every time zone, including the ones that shift.

const newYork = "America/New_York";
const kathmandu = "Asia/Kathmandu";

describe("the start of a day", () => {
  it("given an instant in the afternoon, gives that day's midnight in the time zone", () => {
    expect(startOfDayIn(newYork, new Date("2026-09-18T16:00:00Z"))).toStrictEqual(
      new Date("2026-09-18T04:00:00Z"),
    );
  });

  it("given an instant in a time zone offset by a part of an hour, keeps the part", () => {
    // 16:00 UTC is a quarter to ten in the evening in Kathmandu, so the day began the
    // afternoon before, in UTC terms.
    expect(startOfDayIn(kathmandu, new Date("2026-09-18T16:00:00Z"))).toStrictEqual(
      new Date("2026-09-17T18:15:00Z"),
    );
  });

  it("given an instant late at night, gives the day it is locally, not the day it is in UTC", () => {
    expect(startOfDayIn(newYork, new Date("2026-09-19T03:00:00Z"))).toStrictEqual(
      new Date("2026-09-18T04:00:00Z"),
    );
  });
});

describe("a range of whole days", () => {
  it("given a week, ends at the start of the day a week on", () => {
    expect(wholeDaysFrom(newYork, new Date("2026-09-18T16:00:00Z"), 7)).toStrictEqual({
      from: new Date("2026-09-18T04:00:00Z"),
      to: new Date("2026-09-25T04:00:00Z"),
    });
  });

  it("given a week that crosses the end of daylight saving, still starts and ends at midnight", () => {
    expect(wholeDaysFrom(newYork, new Date("2026-10-30T16:00:00Z"), 7)).toStrictEqual({
      from: new Date("2026-10-30T04:00:00Z"),
      to: new Date("2026-11-06T05:00:00Z"),
    });
  });

  it("given a week that crosses the start of daylight saving, still starts and ends at midnight", () => {
    expect(wholeDaysFrom(newYork, new Date("2026-03-06T17:00:00Z"), 7)).toStrictEqual({
      from: new Date("2026-03-06T05:00:00Z"),
      to: new Date("2026-03-13T04:00:00Z"),
    });
  });
});

describe("the range used when none is given", () => {
  it("covers the start of today, for a week", () => {
    expect(defaultRange(newYork, new Date("2026-09-18T16:00:00Z"))).toStrictEqual({
      from: new Date("2026-09-18T04:00:00Z"),
      to: new Date("2026-09-25T04:00:00Z"),
    });
  });
});
