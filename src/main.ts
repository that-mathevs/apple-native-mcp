import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { calendarEventStore } from "./adapters/native/calendar-event-store.js";
import { Helper } from "./adapters/native/helper.js";
import { helperReminderStore } from "./adapters/native/reminder-store.js";
import { helperPathSetting, settingsFrom } from "./domain/settings.js";
import { buildServer } from "./mcp/server.js";

/**
 * The composition root: the one place an adapter meets a use case.
 *
 * The helper's path comes from the environment so a development build can be used in place of the
 * installed one; where it is installed, and the signature check before it is launched, belong to
 * `setup` (ADR-0003).
 */
const helperPath = process.env[helperPathSetting] ?? "native/.build/release/apple-native-mcp";

const helper = new Helper(helperPath);

const settings = settingsFrom(process.env);

// stdout belongs to the protocol. A client shows a server's stderr in its log, which is the one
// place a user looks when a write they switched on is not offered.
if (settings.unparsed !== undefined) {
  console.error(`apple-native-mcp: every write capability is off. ${settings.unparsed}`);
}

const server = buildServer({
  eventStore: calendarEventStore(helper),
  reminderStore: helperReminderStore(helper),
  now: () => new Date(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  settings,
});

const stopping = (): void => {
  helper.stop();
  process.exit(0);
};

process.on("SIGINT", stopping);
process.on("SIGTERM", stopping);

await server.connect(new StdioServerTransport());
