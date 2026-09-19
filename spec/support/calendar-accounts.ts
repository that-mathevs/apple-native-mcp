import type { CalendarAccount } from "../../src/domain/calendar-account.js";

// The calendar accounts the calendar and reminders scenarios are set in.

export const iCloud: CalendarAccount = { identifier: "account-icloud", title: "iCloud" };
export const exchange: CalendarAccount = { identifier: "account-exchange", title: "Exchange" };
export const subscriptions: CalendarAccount = {
  identifier: "account-subscriptions",
  title: "Subscriptions",
};
export const onMyMac: CalendarAccount = { identifier: "account-on-my-mac", title: "On My Mac" };
