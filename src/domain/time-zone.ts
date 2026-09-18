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
export const startOfDay = (timeZone: string, day: LocalDay): Date => {
  const midnightAsUtc = Date.UTC(day.year, day.month - 1, day.day);

  const firstGuess = new Date(midnightAsUtc - offsetAt(new Date(midnightAsUtc), timeZone));
  return new Date(midnightAsUtc - offsetAt(firstGuess, timeZone));
};

const twoDigits = (value: number): string => String(value).padStart(2, "0");

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
