/** A calendar an event belongs to: titles repeat across accounts, so the identifier addresses it. */
export type Calendar = {
  readonly identifier: string;
  readonly title: string;
  readonly account: string;
};

/**
 * One dated instance of an event in a range.
 *
 * Every occurrence of a series carries the series' own identifier, so an occurrence is told
 * apart by its start rather than by an identifier of its own (upstream returned a series once,
 * whatever the range asked for).
 */
export type Occurrence = {
  readonly identifier: string;
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly isAllDay: boolean;
  readonly calendar: Calendar;
};

/** Occurrences in the order a reader expects them: earliest first, then by title. */
export const inStartOrder = (occurrences: readonly Occurrence[]): readonly Occurrence[] =>
  [...occurrences].sort(
    (left, right) =>
      left.start.getTime() - right.start.getTime() || left.title.localeCompare(right.title),
  );
