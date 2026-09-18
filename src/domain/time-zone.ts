/**
 * Days and wall-clock times in a time zone, which every context reads its dates in.
 *
 * The rules here are arithmetic on the calendar, not on hours: a day that crosses a
 * daylight-saving change is still one day, and an offset of part of an hour stays part of one.
 */

/** A day as a calendar tells it, with no time of day and no time zone. */
export type LocalDay = { readonly year: number; readonly month: number; readonly day: number };

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

const offsetFormatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const known = offsetFormatters.get(timeZone);
  if (known) return known;

  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
  offsetFormatters.set(timeZone, formatter);
  return formatter;
};

/** The time zone's offset from UTC at an instant, in milliseconds, east of UTC positive. */
const offsetAt = (instant: Date, timeZone: string): number => {
  const name = offsetFormatterFor(timeZone)
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;

  const offset = /GMT(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2})/u.exec(name ?? "");
  if (!offset?.groups) return 0;

  const { sign, hours, minutes } = offset.groups as {
    sign: string;
    hours: string;
    minutes: string;
  };
  const magnitude = (Number(hours) * 60 + Number(minutes)) * 60 * 1000;
  return sign === "-" ? -magnitude : magnitude;
};

/** The day an instant falls on in the time zone. */
export const dayIn = (timeZone: string, instant: Date): LocalDay => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

  const [year, month, day] = parts.split("-").map(Number) as [number, number, number];
  return { year, month, day };
};

/**
 * The instant a local day begins, given the day itself.
 *
 * The offset is read twice: once at a first guess, and once at the instant that guess gives,
 * so a day that begins either side of a daylight-saving change still starts at its own
 * midnight.
 */
export const startOfDay = (timeZone: string, day: LocalDay): Date =>
  instantAt(timeZone, { ...day, hour: 0, minute: 0, second: 0 });

/** A time as a clock on the wall shows it: a day, and a time of day, in no time zone. */
export type WallClock = LocalDay & {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

/**
 * The instant a wall clock in the time zone shows this time, read the same way as a day's
 * start: the offset at a first guess, then the offset at the instant that guess gives, so a time
 * either side of a daylight-saving change keeps the offset in force at it.
 */
export const instantAt = (timeZone: string, time: WallClock): Date => {
  const { year, month, day, hour, minute, second } = time;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  const firstGuess = new Date(asUtc - offsetAt(new Date(asUtc), timeZone));
  return new Date(asUtc - offsetAt(firstGuess, timeZone));
};

/** The wall-clock time a written one names, with no offset: `2026-09-25T17:00`, seconds or not. */
export const wallClockWritten = (written: string): WallClock => {
  const [date = "", clock = ""] = written.split("T");
  const [hour = 0, minute = 0, second = 0] = clock.split(":").map(Number);
  return { ...dayWritten(date), hour, minute, second };
};

const twoDigits = (value: number): string => String(value).padStart(2, "0");

/** The day a written date names. It has to be a real one already: `2026-09-25`. */
export const dayWritten = (written: string): LocalDay => {
  const [year, month, day] = written.split("-").map(Number) as [number, number, number];
  return { year, month, day };
};

/** Whether one day comes before another on the calendar. */
export const isBefore = (left: LocalDay, right: LocalDay): boolean =>
  Date.UTC(left.year, left.month - 1, left.day) < Date.UTC(right.year, right.month - 1, right.day);

/** A day written the way ISO 8601 writes a date: `2026-09-25`. */
export const writtenDay = ({ year, month, day }: LocalDay): string =>
  `${String(year)}-${twoDigits(month)}-${twoDigits(day)}`;

const writtenOffset = (offset: number): string => {
  const minutes = Math.abs(offset) / 60_000;
  const sign = offset < 0 ? "-" : "+";
  return `${sign}${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;
};

/**
 * An instant as the user's clock shows it, with the offset in force there at that instant:
 * `2026-09-25T17:00:00-04:00`. It is still one instant everywhere, and a wrong zone is visible
 * at a glance.
 */
export const writtenWallClock = (timeZone: string, instant: Date): string => {
  const offset = offsetAt(instant, timeZone);
  const shown = new Date(instant.getTime() + offset);
  const day = writtenDay({
    year: shown.getUTCFullYear(),
    month: shown.getUTCMonth() + 1,
    day: shown.getUTCDate(),
  });
  const clock = [shown.getUTCHours(), shown.getUTCMinutes(), shown.getUTCSeconds()]
    .map(twoDigits)
    .join(":");

  return `${day}T${clock}${writtenOffset(offset)}`;
};

/**
 * The instant a written time names: with an offset or Z it is that instant, and without one it is
 * the time the user's own clock shows, never UTC's (upstream #34).
 */
export const instantWritten = (timeZone: string, written: string): Date =>
  /(?:Z|[+-]\d{2}:\d{2})$/u.test(written)
    ? new Date(written)
    : instantAt(timeZone, wallClockWritten(written));
