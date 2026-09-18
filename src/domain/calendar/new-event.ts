import type { NamedFailure, Outcome } from "../failure.js";
import { failed, nothingCreated, succeeded } from "../failure.js";
import { excludes, type Exclusion } from "../settings.js";
import { isBefore, type LocalDay } from "../time-zone.js";
import type { Calendar, Occurrence } from "./event.js";
import { wholeDays, type Range } from "./range.js";

/**
 * When a new event is. A timed event has a start and an end. An all-day event has a first day
 * and a last day, and they stay days all the way to the store: turned into instants on the
 * way, they slide to the day before or after whenever the machine doing the turning is in
 * another time zone (upstream #34, arr2036 3a26c9a).
 */
export type EventTime =
  | { readonly kind: "timed"; readonly start: Date; readonly end: Date }
  | { readonly kind: "allDay"; readonly firstDay: LocalDay; readonly lastDay: LocalDay };

/** An event that does not exist yet, and the calendar it is to be created in. */
export type NewEvent = {
  readonly title: string;
  readonly calendarIdentifier: string;
  readonly time: EventTime;
  readonly location?: string;
  readonly notes?: string;
};

/** How a caller says when a new event is: a start and an end, or a first day and perhaps a last. */
export type GivenTime = {
  readonly start?: Date;
  readonly end?: Date;
  readonly firstDay?: LocalDay;
  readonly lastDay?: LocalDay;
};

const timeInvalid = (sentence: string): NamedFailure =>
  nothingCreated("event-time-invalid", sentence);

/**
 * When the new event is, or why that can't be told. Nothing is guessed: an event with a start
 * and no end has no length, and one given both ways could mean either.
 */
export const timeFrom = ({ start, end, firstDay, lastDay }: GivenTime): Outcome<EventTime> => {
  const timed = start !== undefined || end !== undefined;
  const allDay = firstDay !== undefined || lastDay !== undefined;

  if (timed === allDay) {
    return failed(
      timeInvalid("Give a start and an end, or a first day for an all-day event, and not both."),
    );
  }

  if (allDay) {
    if (firstDay === undefined) return failed(timeInvalid("A last day needs a first day."));
    if (lastDay !== undefined && isBefore(lastDay, firstDay)) {
      return failed(timeInvalid("The last day is before the first."));
    }
    return succeeded({ kind: "allDay", firstDay, lastDay: lastDay ?? firstDay });
  }

  if (start === undefined || end === undefined) {
    return failed(timeInvalid("Give both a start and an end."));
  }

  if (end <= start) return failed(timeInvalid("The end has to be after the start."));

  return succeeded({ kind: "timed", start, end });
};

/** The instants an event's time covers, an all-day event covering whole days in the time zone. */
export const rangeOf = (time: EventTime, timeZone: string): Range =>
  time.kind === "timed"
    ? { from: time.start, to: time.end }
    : wholeDays(timeZone, time.firstDay, time.lastDay);

const sameTitle = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * The event already there that a new one would duplicate: same title, overlapping time. How
 * the title is capitalised or padded is not a difference a person would see in their calendar.
 */
export const duplicateOf = (
  title: string,
  { from, to }: Range,
  occurrences: readonly Occurrence[],
): Occurrence | undefined =>
  occurrences.find(
    (occurrence) =>
      sameTitle(occurrence.title, title) && occurrence.start < to && occurrence.end > from,
  );

export const duplicate = (already: Occurrence): NamedFailure =>
  nothingCreated(
    "event-duplicate",
    "An event with that title already overlaps that time. Read or change that one, or say " +
      "that a duplicate is wanted.",
    `identifier ${already.identifier}, starting ${already.start.toISOString()}` +
      (already.originalStart === undefined
        ? ""
        : `, original start ${already.originalStart.toISOString()}`),
  );

const mayBeWrittenTo = (calendar: Calendar, exclusion: Exclusion): boolean =>
  calendar.acceptsNewEvents && !excludes(exclusion, calendar.identifier);

/**
 * The calendar an identifier names, when a new event may go there. A calendar the settings
 * exclude answers exactly as one that doesn't exist, and nothing is ever offered in its place:
 * an event never lands anywhere it wasn't sent (arr2036 9097294 fell back to the default).
 */
export const calendarIdentifiedBy = (
  identifier: string,
  calendars: readonly Calendar[],
  exclusion: Exclusion,
): Outcome<Calendar> => {
  const found = calendars.find(
    (calendar) => calendar.identifier === identifier && !excludes(exclusion, identifier),
  );

  if (found === undefined) {
    return failed(
      nothingCreated(
        "calendar-not-found",
        "No calendar has that identifier. List the calendars to find one that accepts new events.",
      ),
    );
  }

  return found.acceptsNewEvents
    ? succeeded(found)
    : failed(
        nothingCreated(
          "calendar-not-writable",
          "That calendar does not accept new events. List the calendars to find one that does.",
        ),
      );
};

/** The default calendar, when there is one and a new event may go there. */
export const defaultCalendarToUse = (
  defaultCalendar: Calendar | undefined,
  exclusion: Exclusion,
): Outcome<Calendar> =>
  defaultCalendar !== undefined && mayBeWrittenTo(defaultCalendar, exclusion)
    ? succeeded(defaultCalendar)
    : failed(
        nothingCreated(
          "calendar-identifier-needed",
          "There is no default calendar this server may write to, so give the identifier of " +
            "the calendar to use.",
        ),
      );
