import type { NamedFailure } from "./failure.js";
import { dayIn, type LocalDay, startOfDay } from "./time-zone.js";

/** One end of a range as written: an instant, or a whole day in the user's time zone. */
export type Bound = { readonly at: Date } | { readonly day: LocalDay };

/** The range a search covers, as two instants. */
export type SearchRange = { readonly from: Date; readonly to: Date };

export const rangeNotForwards: NamedFailure = {
  code: "range-not-forwards",
  sentence: "Nothing was searched: the range ends at or before it starts.",
};

const dayAfter = (day: LocalDay): LocalDay => ({ ...day, day: day.day + 1 });

const daysBefore = (instant: Date, days: number): Date =>
  new Date(instant.getTime() - days * 24 * 60 * 60 * 1000);

/**
 * The range a search covers. A day alone is the whole of that day (MSG-77), from its local
 * midnight (MSG-78). With neither end, it is the last `days` whole days, today included; with
 * only an end, the `days` before it; with only a start, from it until tomorrow.
 */
export const searchRangeOf = (
  { from, to }: { readonly from?: Bound | undefined; readonly to?: Bound | undefined },
  now: Date,
  timeZone: string,
  days: number,
): SearchRange => {
  const today = dayIn(timeZone, now);
  const end =
    to === undefined
      ? startOfDay(timeZone, dayAfter(today))
      : "at" in to
        ? to.at
        : startOfDay(timeZone, dayAfter(to.day));
  const start =
    from === undefined
      ? to === undefined
        ? startOfDay(timeZone, { ...today, day: today.day - (days - 1) })
        : daysBefore(end, days)
      : "at" in from
        ? from.at
        : startOfDay(timeZone, from.day);
  return { from: start, to: end };
};
