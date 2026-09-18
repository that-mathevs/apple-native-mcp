import { dayIn, startOfDay, type LocalDay } from "../time-zone.js";

/** The start and end instants a read covers. Date-only bounds mean whole days locally. */
export type Range = {
  readonly from: Date;
  readonly to: Date;
};

/** How many days a read covers when the caller gives no range (#20). */
export const defaultRangeDays = 7;

/** The instant the day containing this one begins in the time zone. */
export const startOfDayIn = (timeZone: string, instant: Date): Date =>
  startOfDay(timeZone, dayIn(timeZone, instant));

/**
 * A range of whole local days, starting at the beginning of the day it is given.
 *
 * The end is a day counted on the calendar, not a number of hours added: a week that crosses
 * a daylight-saving change is still seven local days, and adding 7 x 24 hours would land an
 * hour into the day before.
 */
export const wholeDaysFrom = (timeZone: string, instant: Date, days: number): Range => {
  const first = dayIn(timeZone, instant);
  return {
    from: startOfDay(timeZone, first),
    to: startOfDay(timeZone, { ...first, day: first.day + days }),
  };
};

/** The instants a run of whole days covers in a time zone, from a first day to a last one. */
export const wholeDays = (timeZone: string, firstDay: LocalDay, lastDay: LocalDay): Range => ({
  from: startOfDay(timeZone, firstDay),
  to: startOfDay(timeZone, { ...lastDay, day: lastDay.day + 1 }),
});

/** The range a read covers when the caller gave neither bound: today, for a week. */
export const defaultRange = (timeZone: string, now: Date): Range =>
  wholeDaysFrom(timeZone, now, defaultRangeDays);
