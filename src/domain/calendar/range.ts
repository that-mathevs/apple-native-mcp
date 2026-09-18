/** The start and end instants a read covers. Date-only bounds mean whole days locally. */
export type Range = {
  readonly from: Date;
  readonly to: Date;
};

/** How many days a read covers when the caller gives no range (#20). */
export const defaultRangeDays = 7;

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

  const { sign, hours, minutes } = offset.groups as { sign: string; hours: string; minutes: string };
  const magnitude = (Number(hours) * 60 + Number(minutes)) * 60 * 1000;
  return sign === "-" ? -magnitude : magnitude;
};

/** A day as a calendar tells it, which is what a whole-day range is counted in. */
type LocalDay = { readonly year: number; readonly month: number; readonly day: number };

const partsIn = (instant: Date, timeZone: string): LocalDay => {
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
const startOfDay = (timeZone: string, day: LocalDay): Date => {
  const midnightAsUtc = Date.UTC(day.year, day.month - 1, day.day);

  const firstGuess = new Date(midnightAsUtc - offsetAt(new Date(midnightAsUtc), timeZone));
  return new Date(midnightAsUtc - offsetAt(firstGuess, timeZone));
};

/** The instant the day containing this one begins in the time zone. */
export const startOfDayIn = (timeZone: string, instant: Date): Date =>
  startOfDay(timeZone, partsIn(instant, timeZone));

/**
 * A range of whole local days, starting at the beginning of the day it is given.
 *
 * The end is a day counted on the calendar, not a number of hours added: a week that crosses
 * a daylight-saving change is still seven local days, and adding 7 x 24 hours would land an
 * hour into the day before.
 */
export const wholeDaysFrom = (timeZone: string, instant: Date, days: number): Range => {
  const first = partsIn(instant, timeZone);
  return {
    from: startOfDay(timeZone, first),
    to: startOfDay(timeZone, { ...first, day: first.day + days }),
  };
};

/** The range a read covers when the caller gave neither bound: today, for a week. */
export const defaultRange = (timeZone: string, now: Date): Range =>
  wholeDaysFrom(timeZone, now, defaultRangeDays);
