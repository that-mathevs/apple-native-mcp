/**
 * The source a calendar or a reminder list belongs to: iCloud, CalDAV, Exchange or local.
 * Calendar and Reminders share these sources, so both contexts use this one word. Its title is
 * what the user sees and repeats (Exchange sources are often all "Exchange"), so the identifier
 * is what tells two apart.
 */
export type CalendarAccount = {
  readonly identifier: string;
  readonly title: string;
};
