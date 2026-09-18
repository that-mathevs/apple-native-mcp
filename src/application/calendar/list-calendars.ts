import type { Calendar } from "../../domain/calendar/event.js";
import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { excludes, type Settings } from "../../domain/settings.js";
import type { EventStore } from "./event-store.js";

export type CalendarIndex = {
  readonly calendars: readonly Calendar[];
  /** How many calendars the settings kept from the agent: a number, never which. */
  readonly calendarsExcluded: number;
};

export type ListCalendarsDependencies = {
  readonly eventStore: EventStore;
  readonly settings: Settings;
};

export const listCalendars = async ({
  eventStore,
  settings,
}: ListCalendarsDependencies): Promise<Outcome<CalendarIndex>> => {
  const read = await eventStore.calendars();

  if (!read.ok) return read;

  const kept = read.value.filter(({ identifier }) => !excludes(settings.calendars, identifier));

  return succeeded({ calendars: kept, calendarsExcluded: read.value.length - kept.length });
};
