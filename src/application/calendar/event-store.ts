import type { Calendar, EventReference, Occurrence } from "../../domain/calendar/event.js";
import type { Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";

/** What a read of a range found, and how much of the store it reached. */
export type EventsInRange = {
  readonly occurrences: readonly Occurrence[];
  /** Every calendar the store asked, whether or not it held anything in the range. */
  readonly calendars: readonly Calendar[];
  /**
   * The identifiers of the calendars that were asked and didn't answer, so a short list isn't
   * read as an empty diary, and so one the settings exclude can be left out of that too.
   */
  readonly unreadCalendars: readonly string[];
};

/** The store events are read from. The helper implements it; a fake stands in for specs. */
export type EventStore = {
  /** Every calendar the store has, whatever it holds. */
  calendars: () => Promise<Outcome<readonly Calendar[]>>;
  /**
   * The one event a reference names, or nothing when the store has no such event. A reference
   * with no original start names the event itself, or a series' first occurrence.
   */
  event: (reference: EventReference) => Promise<Outcome<Occurrence | undefined>>;
  occurrencesIn: (range: Range) => Promise<Outcome<EventsInRange>>;
};
