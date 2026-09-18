import type { EventStore, EventsInRange } from "../../application/calendar/event-store.js";
import type { Calendar, EventReference, Occurrence } from "../../domain/calendar/event.js";
import type { Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Helper } from "./helper.js";

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

export const calendarEventStore = (helper: Helper): EventStore => ({
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

/** Ask the user for calendar access, which prompts only while nobody has been asked. */
export const askForCalendarAccess = async (helper: Helper): Promise<Outcome<string>> => {
  const answered = await helper.ask({ request: "calendar_permission_request" });
  if (!answered.ok) return failed(answered.failure);

  const state = answered.value.state;
  return succeeded(typeof state === "string" ? state : "unknown");
};
