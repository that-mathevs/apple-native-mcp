import type {
  CreatedEvent,
  EventStore,
  EventsInRange,
} from "../../application/calendar/event-store.js";
import type {
  Calendar,
  EventReference,
  Occurrence,
} from "../../domain/calendar/event.js";
import type { NewEvent } from "../../domain/calendar/new-event.js";
import type { Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { writtenDay } from "../../domain/time-zone.js";
import { wentUnanswered, type Helper } from "./helper.js";

/**
 * The event store as the helper answers it.
 *
 * Nothing here decides anything: it asks the helper, and turns the records it sends back into the
 * domain's words. The rules about what a range means, and what order occurrences come in, live
 * above it and are specified without a Mac.
 */

type CalendarRecord = {
  readonly identifier: string;
  readonly title: string;
  readonly acceptsNewEvents: boolean;
  readonly account: { readonly identifier: string; readonly title: string };
};

type EventRecord = {
  readonly eventIdentifier: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly allDay: boolean;
  readonly location: string | null;
  readonly notes: string | null;
  readonly originalStart: string | null;
  readonly calendar: CalendarRecord;
};

const asCalendar = (record: CalendarRecord): Calendar => ({
  identifier: record.identifier,
  title: record.title,
  account: record.account.title,
  acceptsNewEvents: record.acceptsNewEvents,
});

const asOccurrence = (record: EventRecord): Occurrence => ({
  identifier: record.eventIdentifier,
  title: record.title,
  start: new Date(record.start),
  end: new Date(record.end),
  isAllDay: record.allDay,
  calendar: asCalendar(record.calendar),
  ...(record.originalStart === null ? {} : { originalStart: new Date(record.originalStart) }),
  ...(record.location === null ? {} : { location: record.location }),
  ...(record.notes === null ? {} : { notes: record.notes }),
});

/** An all-day event goes as its days and a timed one as its instants: see `EventTime`. */
const asTimeFields = ({ time }: NewEvent): Record<string, string> =>
  time.kind === "allDay"
    ? { firstDay: writtenDay(time.firstDay), lastDay: writtenDay(time.lastDay) }
    : { start: time.start.toISOString(), end: time.end.toISOString() };

export const calendarEventStore = (helper: Helper): EventStore => ({
  defaultCalendar: async (): Promise<Outcome<Calendar | undefined>> => {
    const answered = await helper.ask({ request: "default_calendar" });

    if (!answered.ok) return failed(answered.failure);

    const { calendar } = answered.value as { calendar?: CalendarRecord | null };

    return succeeded(
      calendar === undefined || calendar === null ? undefined : asCalendar(calendar),
    );
  },

  create: async (event: NewEvent): Promise<Outcome<CreatedEvent>> => {
    const answered = await helper.askOnce({
      request: "create_event",
      calendarIdentifier: event.calendarIdentifier,
      title: event.title,
      ...asTimeFields(event),
      ...(event.location === undefined ? {} : { location: event.location }),
      ...(event.notes === undefined ? {} : { notes: event.notes }),
    });

    // The helper died, or was stopped, with the request in hand: it may have saved the event.
    if (!answered.ok && wentUnanswered(answered.failure)) {
      return succeeded({ confirmed: false });
    }

    if (!answered.ok) return failed(answered.failure);

    const { event: saved, confirmed } = answered.value as {
      event: EventRecord;
      confirmed: boolean;
    };

    return succeeded({ event: asOccurrence(saved), confirmed });
  },

  calendars: async (): Promise<Outcome<readonly Calendar[]>> => {
    const answered = await helper.ask({ request: "calendars" });

    if (!answered.ok) return failed(answered.failure);

    const { calendars } = answered.value as { calendars?: CalendarRecord[] };

    return succeeded((calendars ?? []).map(asCalendar));
  },

  event: async ({
    identifier,
    originalStart,
  }: EventReference): Promise<Outcome<Occurrence | undefined>> => {
    const answered = await helper.ask({
      request: "event",
      eventIdentifier: identifier,
      ...(originalStart === undefined ? {} : { originalStart: originalStart.toISOString() }),
    });

    if (!answered.ok) return failed(answered.failure);

    const { event } = answered.value as { event?: EventRecord | null };

    return succeeded(event === undefined || event === null ? undefined : asOccurrence(event));
  },

  occurrencesIn: async (range: Range): Promise<Outcome<EventsInRange>> => {
    const answered = await helper.ask({
      request: "events_in_range",
      range: { start: range.from.toISOString(), end: range.to.toISOString() },
    });

    if (!answered.ok) return failed(answered.failure);

    const { events, calendars, unreadableCalendars } = answered.value as {
      events?: EventRecord[];
      calendars?: CalendarRecord[];
      unreadableCalendars?: { readonly calendar: CalendarRecord }[];
    };

    return succeeded({
      occurrences: (events ?? []).map(asOccurrence),
      calendars: (calendars ?? []).map(asCalendar),
      unreadCalendars: (unreadableCalendars ?? []).map(({ calendar }) => calendar.identifier),
    });
  },
});
