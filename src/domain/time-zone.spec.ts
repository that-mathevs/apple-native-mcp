import { describe, expect, it } from "vitest";

import {
  instantAt,
  instantWritten,
  wallClockWritten,
  writtenDay,
  writtenWallClock,
} from "./time-zone.js";

// Upstream #34: a due time came back in UTC, so "remind me at 5" read as 9pm, and nothing in
// the answer said which zone it was in. A time is written as the user's clock shows it, with
// the offset that makes it one instant everywhere.

const newYork = "America/New_York";

describe("a wall-clock time", () => {
  it("given an instant, writes the time the user's clock shows, with the offset in force there", () => {
    expect(writtenWallClock(newYork, new Date("2026-09-25T21:00:00Z"))).toBe(
      "2026-09-25T17:00:00-04:00",
    );
  });

  it("given an instant already tomorrow in UTC, writes the day it still is for the user", () => {
    expect(writtenWallClock(newYork, new Date("2026-09-26T01:30:00Z"))).toBe(
      "2026-09-25T21:30:00-04:00",
    );
  });

  it("given an instant in winter, writes the offset in force in winter, not the one in force today", () => {
    expect(writtenWallClock(newYork, new Date("2026-12-01T22:00:00Z"))).toBe(
      "2026-12-01T17:00:00-05:00",
    );
  });

  it("given a time zone offset by part of an hour, keeps the part", () => {
    expect(writtenWallClock("Asia/Kathmandu", new Date("2026-09-25T11:15:00Z"))).toBe(
      "2026-09-25T17:00:00+05:45",
    );
  });

  it("given a time zone with no offset, writes the offset as zero rather than leaving it out", () => {
    expect(writtenWallClock("UTC", new Date("2026-09-25T17:00:00Z"))).toBe(
      "2026-09-25T17:00:00+00:00",
    );
  });
});

describe("a day", () => {
  it("given a day early in the year, writes it as ISO 8601 does, month and day in two digits", () => {
    expect(writtenDay({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
  });
});

// chrischall 6831a90 and upstream #34: "remind me at 5" was read in UTC, an hour or more off.
describe("a wall-clock time as an instant", () => {
  const five = (written: string): ReturnType<typeof wallClockWritten> => wallClockWritten(written);

  it("given five in the afternoon on a September day in New York, is the instant the user's clock shows five", () => {
    expect(instantAt(newYork, five("2026-09-25T17:00:00"))).toStrictEqual(
      new Date("2026-09-25T21:00:00Z"),
    );
  });

  it("given the same time in winter, keeps it on the clock rather than on summer's offset", () => {
    expect(instantAt(newYork, five("2026-12-01T17:00:00"))).toStrictEqual(
      new Date("2026-12-01T22:00:00Z"),
    );
  });

  it("given a time zone offset by part of an hour, keeps the part", () => {
    expect(instantAt("Asia/Kathmandu", five("2026-09-25T17:00:00"))).toStrictEqual(
      new Date("2026-09-25T11:15:00Z"),
    );
  });

  it("given a time written without seconds, reads it as on the minute", () => {
    expect(wallClockWritten("2026-09-25T17:00")).toStrictEqual(
      wallClockWritten("2026-09-25T17:00:00"),
    );
  });
});

// mjmcg bde3e31 read the digits and dropped the offset, so a time given for Berlin moved.
describe("a written time", () => {
  it("given an offset, is that instant, whatever the user's time zone", () => {
    expect(instantWritten(newYork, "2026-09-25T17:00:00+02:00")).toStrictEqual(
      new Date("2026-09-25T15:00:00Z"),
    );
  });

  it("given Z, is that instant in UTC", () => {
    expect(instantWritten(newYork, "2026-09-25T17:00:00Z")).toStrictEqual(
      new Date("2026-09-25T17:00:00Z"),
    );
  });

  it("given no offset, is the time the user's own clock shows", () => {
    expect(instantWritten(newYork, "2026-09-25T17:00:00")).toStrictEqual(
      new Date("2026-09-25T21:00:00Z"),
    );
  });
});
