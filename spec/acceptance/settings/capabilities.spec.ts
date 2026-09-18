import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, it } from "vitest";

import { settingsFrom } from "../../../src/domain/settings.js";
import { serverOffering } from "../../../src/mcp/server.js";
import { aToolThatNamesNoCapability } from "../../support/a-tool-that-remembers.js";
import { aClientOfTheCalendar, work } from "../../support/calendar-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeEventStore } from "../../support/fake-event-store.js";

// What an agent is offered, and what it is refused, depending on the capabilities the user
// switched on. `create_event` is the write these scenarios use; the rule belongs to the server,
// not to any one tool, and every write tool is held to it.

const lunch = {
  title: "Lunch",
  start: "2026-09-22T12:30:00-04:00",
  end: "2026-09-22T13:30:00-04:00",
};

/** A client of the real server whose settings came from this client configuration. */
const connectedWith = async (
  configuration: Record<string, string>,
): Promise<{ client: Client; eventStore: FakeEventStore }> => {
  const eventStore = new FakeEventStore();
  eventStore.hasCalendars(work);
  eventStore.defaultsTo(work);

  return { client: await aClientOfTheCalendar(eventStore, configuration), eventStore };
};

/** The write tools on offer: every tool that does not say it only reads. */
const writesOffered = async (client: Client): Promise<string[]> =>
  (await client.listTools()).tools
    .filter((tool) => tool.annotations?.readOnlyHint !== true)
    .map((tool) => tool.name);

const offered = async (client: Client): Promise<string[]> =>
  (await client.listTools()).tools.map((tool) => tool.name);

describe("switching capabilities on", () => {
  // sicdigital e066b89 listed the writes to deny, so every write it had not heard of was on.
  it("given a client's configuration that names no capability, offers only the tools that read: a write is off until it is named", async () => {
    const { client } = await connectedWith({});

    expect(await writesOffered(client)).toStrictEqual([]);
    expect(await offered(client)).toContain("list_events");
  });

  it("given a write capability the client's configuration names, offers its tool and carries out a call", async () => {
    const { client, eventStore } = await connectedWith({
      APPLE_NATIVE_MCP_CAPABILITIES: "create_event",
    });

    const result = await client.callTool({ name: "create_event", arguments: lunch });

    expect(await writesOffered(client)).toStrictEqual(["create_event"]);
    expect(result.structuredContent).toMatchObject({ outcome: "created" });
    expect(eventStore.created).toMatchObject([{ title: "Lunch" }]);
  });

  // gene-jelly b99bbce left the tool out of the list and left it callable; a client holding
  // an older list, or an agent guessing the name, walked straight past the setting.
  it("given a call to a tool whose capability is off, refuses it as switched off and names the setting to add: a tool that is not offered still refuses", async () => {
    const { client, eventStore } = await connectedWith({});

    const result = await client.callTool({ name: "create_event", arguments: lunch });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "capability-off",
        setting: expect.stringContaining("APPLE_NATIVE_MCP_CAPABILITIES") as string,
      },
    });
    expect(result.structuredContent).toMatchObject({
      failure: { setting: expect.stringContaining("create_event") as string },
    });
    expect(eventStore.created).toStrictEqual([]);
  });

  // A misspelt capability that was skipped would leave the user believing the rest of the
  // line was what they had asked for. KassebaumEngineering 13fd400 failed closed the same way.
  it("given settings that do not parse, switches every write capability off, the ones spelt correctly included, and says what it could not read", async () => {
    const { client } = await connectedWith({
      APPLE_NATIVE_MCP_CAPABILITIES: "create_event, send_mesage",
    });

    const result = await client.callTool({ name: "create_event", arguments: lunch });

    expect(await writesOffered(client)).toStrictEqual([]);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "capability-off",
        evidence: expect.stringContaining("send_mesage") as string,
      },
    });
  });

  // The one thing capabilities exist to prevent is an injected agent granting itself a write.
  it("given arguments naming a capability, a setting or a helper path, changes nothing about what is switched on: settings never come from what an agent sends", async () => {
    const { client, eventStore } = await connectedWith({});

    const result = await client.callTool({
      name: "create_event",
      arguments: {
        ...lunch,
        capabilities: ["create_event"],
        APPLE_NATIVE_MCP_CAPABILITIES: "create_event",
        APPLE_NATIVE_MCP_HELPER: "/tmp/not-the-helper",
      },
    });

    expect(result.structuredContent).toMatchObject({ failure: { code: "capability-off" } });
    expect(await writesOffered(client)).toStrictEqual([]);
    expect(eventStore.created).toStrictEqual([]);
  });

  // #19: an unset capability is off, never "on because nothing said otherwise". A write tool
  // that forgot to name its capability must not be the way round that.
  it("given a tool that names no capability and does not say it only reads, never offers it and refuses a call to it", async () => {
    const { tool, created } = aToolThatNamesNoCapability();
    const settings = settingsFrom({ APPLE_NATIVE_MCP_CAPABILITIES: "create_event" });
    const client = await connectedTo(serverOffering([tool], settings));

    const result = await client.callTool({ name: "rename_event", arguments: { title: "Lunch" } });

    expect(await offered(client)).toStrictEqual([]);
    expect(result.structuredContent).toMatchObject({ failure: { code: "tool-not-offered" } });
    expect(created).toStrictEqual([]);
  });
});
