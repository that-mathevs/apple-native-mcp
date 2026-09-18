import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { settingsFrom } from "../../src/domain/settings.js";
import { aServer } from "./a-server.js";
import { connectedTo } from "./connected-client.js";
import type { FakeEventStore } from "./fake-event-store.js";

/** 2026-09-18 12:00 in New York, which is the user's time zone in every calendar scenario. */
export const noon = new Date("2026-09-18T16:00:00Z");
export const timeZone = "America/New_York";

export const work = {
  identifier: "cal-work",
  title: "Work",
  account: "iCloud",
  acceptsNewEvents: true,
} as const;

/** The calendar a user would want kept from an agent. */
export const therapy = { ...work, identifier: "cal-therapy", title: "Therapy" } as const;

/** An agent's client of the real server, with this store behind it and these settings. */
export const aClientOfTheCalendar = async (
  eventStore: FakeEventStore,
  configuration: Record<string, string> = {},
): Promise<Client> =>
  await connectedTo(
    aServer({ eventStore, now: () => noon, timeZone, settings: settingsFrom(configuration) }),
  );
