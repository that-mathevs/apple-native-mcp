import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { settingsFrom } from "../../src/domain/settings.js";
import { reporting } from "../../src/mcp/result.js";
import { serverOffering } from "../../src/mcp/server.js";
import { tool } from "../../src/mcp/tool.js";
import { aToolThatCreatesAnEvent } from "../support/a-tool-that-remembers.js";
import { connectedTo } from "../support/connected-client.js";

// What every call answers with when it cannot be carried out, whichever tool was named. Some
// clients never show a protocol error to the model (upstream #15), so a refusal is always a
// result the agent can read.

/** A read whose record does not match what it told clients to expect. */
const aToolThatMiscounts = tool({
  name: "count_events",
  title: "Count events",
  description: "How many events there are.",
  capability: undefined,
  input: {},
  output: { events: z.number().int() },
  annotations: { readOnlyHint: true },
  call: () => Promise.resolve(reporting({ events: "several" })),
});

describe("calling a tool", () => {
  let client: Client;
  let created: unknown[];

  beforeEach(async () => {
    const standIn = aToolThatCreatesAnEvent();
    created = standIn.created;

    const settings = settingsFrom({ APPLE_NATIVE_MCP_CAPABILITIES: "create_event" });

    client = await connectedTo(serverOffering([standIn.tool, aToolThatMiscounts], settings));
  });

  // faces-sh 42c2fd7 answered "disabled" for names it had never had, which sent users
  // looking for a setting that did not exist.
  it("given a tool name the server has never had, refuses it as unknown rather than switched off, and keeps answering", async () => {
    const result = await client.callTool({ name: "delete_everything", arguments: {} });
    const next = await client.callTool({ name: "create_event", arguments: { title: "Lunch" } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ failure: { code: "tool-unknown" } });
    expect(next.structuredContent).toStrictEqual({ title: "Lunch" });
  });

  it("given arguments that fail validation, refuses before anything is done and names the argument", async () => {
    const result = await client.callTool({ name: "create_event", arguments: { title: 7 } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "arguments-invalid",
        evidence: expect.stringContaining("title") as string,
      },
    });
    expect(created).toStrictEqual([]);
  });

  // ADR-0006: a record is checked against the output schema the tool published, on the way
  // out as well as by the client, so a malformed record is a failure here and not a puzzle there.
  it("given a tool whose record does not match its output schema, reports a named failure rather than the record", async () => {
    const result = await client.callTool({ name: "count_events", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "result-invalid", evidence: expect.stringContaining("events") as string },
    });
  });

  // A client checks every result against the tool's one output schema, refusals included, and
  // throws away a result that does not fit. So the schema has to have room for a named failure.
  it("publishes for every tool an output schema that a refusal fits as well as a record", async () => {
    const { tools } = await client.listTools();

    for (const published of tools) {
      expect(published.outputSchema?.properties).toHaveProperty("failure");
      expect(published.outputSchema?.required ?? []).toStrictEqual([]);
    }
  });
});
