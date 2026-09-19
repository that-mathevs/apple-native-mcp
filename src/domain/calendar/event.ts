import type { CalendarAccount } from "../calendar-account.js";

/** A calendar an event belongs to: titles repeat across accounts, so the identifier addresses it. */
export type Calendar = {
  readonly identifier: string;
  readonly title: string;
  readonly account: CalendarAccount;
  /** Whether it is a writable calendar. Subscriptions and birthdays are not. */
  readonly acceptsNewEvents: boolean;
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
  /** The start this occurrence has within its series. An event in no series has none. */
  readonly originalStart?: Date;
  /** External content when the event is an invitation: someone else may have written it. */
  readonly location?: string;
  /** External content when the event is an invitation: someone else may have written it. */
  readonly notes?: string;
};

/**
 * What a read returns so a later operation can act on exactly that event: its event identifier,
 * and its original start when it is an occurrence of a series.
 */
export type EventReference = {
  readonly identifier: string;
  readonly originalStart?: Date;
};

/** Occurrences in the order a reader expects them: earliest first, then by title. */
export const inStartOrder = (occurrences: readonly Occurrence[]): readonly Occurrence[] =>
  [...occurrences].sort(
    (left, right) =>
      left.start.getTime() - right.start.getTime() || left.title.localeCompare(right.title),
  );

/**
 * Whether an event mentions some text in its title, its location or its notes, ignoring case.
 *
 * The text is compared and never interpreted: it is not a pattern, a query or a script, so
 * whatever it contains matches only itself (upstream #74 and #25 spliced it into AppleScript).
 */
export const mentions = (occurrence: Occurrence, text: string): boolean => {
  // Not the locale's lower case: on a Turkish Mac that would stop "I" matching "i".
  const sought = text.toLowerCase();

  return [occurrence.title, occurrence.location, occurrence.notes].some(
    (field) => field?.toLowerCase().includes(sought) === true,
  );
};

/** How many events an index holds when the caller names no limit, and the most it may name. */
export const defaultLimit = 100;
export const greatestLimit = 500;

/**
 * The earliest occurrences up to a limit, and whether any were left behind. They must already
 * be in start order: a limit keeps what comes first, never whatever the store sent first.
 */
export const earliest = (
  occurrences: readonly Occurrence[],
  limit: number,
): { readonly occurrences: readonly Occurrence[]; readonly truncated: boolean } => ({
  occurrences: occurrences.slice(0, limit),
  truncated: occurrences.length > limit,
});
