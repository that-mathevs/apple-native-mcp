import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ListEventsDependencies } from "../application/calendar/list-events.js";
import { callListEvents, listEventsInput, listEventsOutput } from "./calendar/list-events-tool.js";

export type ServerDependencies = ListEventsDependencies;

export const serverName = "apple-native-mcp";

/**
 * The tools this server offers, built around the ports it is handed.
 *
 * One tool per operation, named with the glossary's words (ADR-0001). A tool that reads
 * says so in its annotations, which clients may use to decide what to ask the user about;
 * nothing here depends on them for safety.
 */
export const buildServer = (dependencies: ServerDependencies): McpServer => {
  const server = new McpServer({ name: serverName, version: "0.0.0" });

  server.registerTool(
    "list_events",
    {
      title: "List calendar events",
      description:
        "The events in a range, each occurrence of a series separately, ordered by start, " +
        "each naming the calendar and account it belongs to.",
      inputSchema: listEventsInput,
      outputSchema: listEventsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (request) => await callListEvents(dependencies, request),
  );

  return server;
};
