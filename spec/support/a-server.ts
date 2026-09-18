import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { settingsFrom } from "../../src/domain/settings.js";
import { buildServer, type ServerDependencies } from "../../src/mcp/server.js";
import { FakeContactStore } from "./fake-contact-store.js";
import { FakeEventStore } from "./fake-event-store.js";
import { FakeMessageStore } from "./fake-message-store.js";
import { FakeReminderStore } from "./fake-reminder-store.js";

/**
 * The server with every tool, and an empty fake behind each port a scenario does not name, so a
 * scenario sets up only what its behaviour reads.
 */
export const aServer = (dependencies: Partial<ServerDependencies>): McpServer =>
  buildServer({
    eventStore: new FakeEventStore(),
    reminderStore: new FakeReminderStore(),
    contactStore: new FakeContactStore(),
    messageStore: new FakeMessageStore(),
    now: () => new Date("2026-09-18T16:00:00Z"),
    timeZone: "America/New_York",
    settings: settingsFrom({}),
    ...dependencies,
  });
