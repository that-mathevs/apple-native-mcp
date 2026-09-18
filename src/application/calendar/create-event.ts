import type { Calendar } from "../../domain/calendar/event.js";
import {
  calendarIdentifiedBy,
  defaultCalendarToUse,
  duplicate,
  duplicateOf,
  rangeOf,
  timeFrom,
  type GivenTime,
} from "../../domain/calendar/new-event.js";
import type { Outcome } from "../../domain/failure.js";
import { failed } from "../../domain/failure.js";
import { excludes, type Settings } from "../../domain/settings.js";
import type { CreatedEvent, EventStore } from "./event-store.js";

export type CreateEventRequest = GivenTime & {
  readonly title: string;
  /** The calendar to create it in. The user's default calendar when left out. */
  readonly calendarIdentifier?: string;
  readonly location?: string;
  readonly notes?: string;
  /** Create it even though an event with the same title already overlaps that time. */
  readonly evenIfDuplicate?: boolean;
};

export type CreateEventDependencies = {
  readonly eventStore: EventStore;
  readonly settings: Settings;
  readonly timeZone: string;
};

const calendarFor = async (
  { eventStore, settings }: CreateEventDependencies,
  identifier: string | undefined,
): Promise<Outcome<Calendar>> => {
  if (identifier === undefined) {
    const read = await eventStore.defaultCalendar();
    return read.ok ? defaultCalendarToUse(read.value, settings.calendars) : read;
  }

  const read = await eventStore.calendars();
  return read.ok ? calendarIdentifiedBy(identifier, read.value, settings.calendars) : read;
};

/**
 * A new event, in the calendar identified or else the user's default calendar.
 *
 * Everything that could refuse it is asked first, so a refusal always means nothing was
 * created: when it is, which calendar, and whether it would be a duplicate. Only events the
 * agent may see count as duplicates, so a refusal never gives away an excluded calendar.
 */
export const createEvent = async (
  dependencies: CreateEventDependencies,
  { title, calendarIdentifier, location, notes, evenIfDuplicate, ...given }: CreateEventRequest,
): Promise<Outcome<CreatedEvent>> => {
  const { eventStore, settings, timeZone } = dependencies;

  const time = timeFrom(given);
  if (!time.ok) return time;

  const calendar = await calendarFor(dependencies, calendarIdentifier);
  if (!calendar.ok) return calendar;

  if (evenIfDuplicate !== true) {
    const range = rangeOf(time.value, timeZone);
    const there = await eventStore.occurrencesIn(range);
    if (!there.ok) return there;

    const seen = there.value.occurrences.filter(
      (occurrence) => !excludes(settings.calendars, occurrence.calendar.identifier),
    );
    const already = duplicateOf(title, range, seen);
    if (already !== undefined) return failed(duplicate(already));
  }

  return await eventStore.create({
    title,
    calendarIdentifier: calendar.value.identifier,
    time: time.value,
    ...(location === undefined ? {} : { location }),
    ...(notes === undefined ? {} : { notes }),
  });
};
