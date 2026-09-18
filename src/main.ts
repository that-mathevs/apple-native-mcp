import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { calendarEventStore } from "./adapters/native/calendar-event-store.js";
import { Helper } from "./adapters/native/helper.js";
import { buildServer } from "./mcp/server.js";

/**
 * The composition root: the one place an adapter meets a use case.
 *
 * The helper's path comes from the environment so a development build can be used in place of the
 * installed one; where it is installed, and the signature check before it is launched, belong to
 * `setup` (ADR-0003).
 */
const helperPath = process.env.APPLE_NATIVE_MCP_HELPER ?? "native/.build/release/apple-native-mcp";

const helper = new Helper(helperPath);

const server = buildServer({
  eventStore: calendarEventStore(helper),
  now: () => new Date(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

const stopping = (): void => {
  helper.stop();
  process.exit(0);
};

process.on("SIGINT", stopping);
process.on("SIGTERM", stopping);

await server.connect(new StdioServerTransport());
