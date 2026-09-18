import type { Occurrence } from "../../domain/calendar/event.js";
import type { Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";

/** What a read of a range found, and how much of the store it reached. */
export type EventsInRange = {
  readonly occurrences: readonly Occurrence[];
  /** Calendars that were asked and didn't answer, so a short list isn't read as an empty diary. */
  readonly calendarsUnread: number;
};

/** The store events are read from. The helper implements it; a fake stands in for specs. */
export type EventStore = {
  occurrencesIn: (range: Range) => Promise<Outcome<EventsInRange>>;
};
