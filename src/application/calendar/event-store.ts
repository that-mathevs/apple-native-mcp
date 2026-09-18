import type {
  Calendar,
  EventReference,
  Occurrence,
} from "../../domain/calendar/event.js";
import type { NewEvent } from "../../domain/calendar/new-event.js";
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

/**
 * What creating an event came to. Confirmed, it is the event as the store holds it. Unconfirmed,
 * the store took the event and could not show it afterwards, or never said what it did with
 * it, and then there may be no event to show. Neither is a failure: a failure invites a second
 * attempt, and a second attempt is how an event ends up in a calendar twice.
 */
export type CreatedEvent = {
  readonly event?: Occurrence;
  readonly confirmed: boolean;
};

/** The store events are read from. The helper implements it; a fake stands in for specs. */
export type EventStore = {
  /** The calendar the user set in Calendar for new events, or nothing when there is none. */
  defaultCalendar: () => Promise<Outcome<Calendar | undefined>>;
  /** Create the event, and answer with it as the store saved it. */
  create: (event: NewEvent) => Promise<Outcome<CreatedEvent>>;
  /** Every calendar the store has, whatever it holds. */
  calendars: () => Promise<Outcome<readonly Calendar[]>>;
  /**
   * The one event a reference names, or nothing when the store has no such event. A reference
   * with no original start names the event itself, or a series' first occurrence.
   */
  event: (reference: EventReference) => Promise<Outcome<Occurrence | undefined>>;
  occurrencesIn: (range: Range) => Promise<Outcome<EventsInRange>>;
};
