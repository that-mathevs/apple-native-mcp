import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { ListEventsDependencies } from "../application/calendar/list-events.js";
import type { NamedFailure } from "../domain/failure.js";
import { capabilityOff, isOn, type Settings } from "../domain/settings.js";
import { listCalendarsTool } from "./calendar/list-calendars-tool.js";
import { listEventsTool } from "./calendar/list-events-tool.js";
import { readEventTool } from "./calendar/read-event-tool.js";
import { searchEventsTool } from "./calendar/search-events-tool.js";
import { refusing } from "./result.js";
import type { Tool } from "./tool.js";

export type ServerDependencies = ListEventsDependencies;

export const serverName = "apple-native-mcp";

/**
 * A tool is offered when its capability is on. One with no capability is offered only when it
 * says it only reads: a write is never on because nothing said otherwise (#19).
 */
const isOffered = (settings: Settings, tool: Tool): boolean =>
  tool.capability === undefined
    ? tool.annotations.readOnlyHint === true
    : isOn(settings, tool.capability);

const notOffered = (settings: Settings, tool: Tool): NamedFailure =>
  tool.capability === undefined
    ? {
        code: "tool-not-offered",
        sentence: `Nothing was done: ${tool.name} changes a store and names no capability.`,
      }
    : capabilityOff(settings, tool.capability);

/**
 * A server offering these tools, as far as the settings allow.
 *
 * Listing and dispatch are ours (ADR-0007). A tool that is not offered has to be absent from
 * the list and still answer a call with a named failure, and the SDK's `McpServer` answers one
 * it has disabled with a bare sentence (gene-jelly b99bbce only removed the tool from the list,
 * which left it callable). So no tool is registered through `McpServer`: it is here for the
 * protocol server it wraps, which the SDK keeps for exactly this kind of use.
 */
export const serverOffering = (tools: readonly Tool[], settings: Settings): McpServer => {
  const mcp = new McpServer({ name: serverName, version: "0.0.0" });
  const { server } = mcp;

  server.registerCapabilities({ tools: {} });

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools
      .filter((tool) => isOffered(settings, tool))
      .map(({ name, title, description, inputSchema, outputSchema, annotations }) => ({
        name,
        title,
        description,
        inputSchema,
        outputSchema,
        annotations,
      })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const called = tools.find((tool) => tool.name === request.params.name);

    if (called === undefined) {
      return refusing({
        code: "tool-unknown",
        sentence: `Nothing was done: this server has no tool called ${request.params.name}.`,
      });
    }

    if (!isOffered(settings, called)) return refusing(notOffered(settings, called));

    return await called.call(request.params.arguments ?? {});
  });

  return mcp;
};

/**
 * The tools this server offers, built around the ports it is handed.
 *
 * One tool per operation, named with the glossary's words (ADR-0001). A tool that reads
 * says so in its annotations, which clients may use to decide what to ask the user about;
 * nothing here depends on them for safety.
 */
export const buildServer = (dependencies: ServerDependencies): McpServer =>
  serverOffering(
    [
      listCalendarsTool(dependencies),
      listEventsTool(dependencies),
      searchEventsTool(dependencies),
      readEventTool(dependencies),
    ],
    dependencies.settings,
  );
