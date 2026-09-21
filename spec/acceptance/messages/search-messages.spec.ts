import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import type { Message } from "../../../src/domain/messages/message.js";
import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeContactNames } from "../../support/fake-contact-names.js";
import { FakeMessageStore } from "../../support/fake-message-store.js";

// Upstream #62 searched with SQL LIKE over plain text alone, so every message kept only as
// archived text was invisible to it, and it never said how much it had looked at. A search here
// reads the messages' text as read_chat does, and always states its coverage.

/** 2026-09-18 12:00 in New York. */
const noon = new Date("2026-09-18T16:00:00Z");

const aMessage = (identifier: string, chat: string, text: string, at: string): Message => ({
  identifier,
  chat,
  text,
  direction: "incoming",
  handle: "ben@example.com",
  timestamp: new Date(at),
  service: "iMessage",
});

const climbing = "iMessage;+;chat001";
const withBen = "iMessage;-;ben@example.com";

describe("searching messages", () => {
  let messageStore: FakeMessageStore;
  let contactNames: FakeContactNames;
  let client: Client;

  const search = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "search_messages", arguments: args });

  beforeEach(async () => {
    messageStore = new FakeMessageStore();
    contactNames = new FakeContactNames();
    client = await connectedTo(
      aServer({ messageStore, contactNames, now: () => noon, timeZone: "America/New_York" }),
    );
  });

  // MSG-19: each match names the chat it came from.
  it("returns the messages that match across every chat, the best match first, each naming its chat", async () => {
    messageStore.holdsMessages(
      aMessage("one", climbing, "bring the rope", "2026-09-18T14:00:00Z"),
      aMessage("both", withBen, "rope at the wall", "2026-09-17T14:00:00Z"),
      aMessage("none", withBen, "see you there", "2026-09-18T15:00:00Z"),
    );

    const result = await search({ query: "rope wall" });

    expect(result.structuredContent).toMatchObject({
      messages: [
        { chat: withBen, identifier: "both", text: "rope at the wall" },
        { chat: climbing, identifier: "one", text: "bring the rope" },
      ],
    });
  });

  // #20: a search with no range covers the last 30 days, and says so.
  it("given no range, searches the last 30 days in the user's time zone and says which range it covered", async () => {
    messageStore.holdsMessages(
      aMessage("recent", climbing, "rope", "2026-09-01T14:00:00Z"),
      aMessage("old", climbing, "rope", "2026-08-01T14:00:00Z"),
    );

    const result = await search({ query: "rope" });

    expect(result.structuredContent).toMatchObject({
      range: { from: "2026-08-20T04:00:00.000Z", to: "2026-09-19T04:00:00.000Z" },
      messages: [{ identifier: "recent" }],
    });
  });

  // MSG-20: a search that stopped before the oldest message says how far back it reached, so "no
  // match" is never read as "not there".
  it("given more messages than it scans, says how many it scanned, that it stopped, and how far back it reached", async () => {
    messageStore.holdsMessages(
      aMessage("newest", climbing, "rope", "2026-09-18T14:00:00Z"),
      aMessage("middle", climbing, "rope", "2026-09-17T14:00:00Z"),
      aMessage("oldest", climbing, "rope", "2026-09-16T14:00:00Z"),
    );
    messageStore.scansAtMost(2);

    const result = await search({ query: "rope" });

    expect(result.structuredContent).toMatchObject({
      coverage: { scanned: 2, truncated: true, reachedBack: "2026-09-17T14:00:00.000Z" },
    });
  });

  it("given everything in the range was scanned, says so", async () => {
    messageStore.holdsMessages(aMessage("only", climbing, "rope", "2026-09-18T14:00:00Z"));

    const result = await search({ query: "rope" });

    expect(result.structuredContent).toMatchObject({ coverage: { scanned: 1, truncated: false } });
  });

  it("given a chat, searches that chat only", async () => {
    messageStore.holdsMessages(
      aMessage("here", climbing, "rope", "2026-09-18T14:00:00Z"),
      aMessage("there", withBen, "rope", "2026-09-18T14:00:00Z"),
    );

    const result = await search({ query: "rope", chat: withBen });

    expect(result.structuredContent).toMatchObject({
      messages: [{ identifier: "there" }],
    });
  });

  it("given messages whose text could not be read, says how many could not be searched", async () => {
    messageStore.holdsMessages(aMessage("fine", climbing, "rope", "2026-09-18T14:00:00Z"), {
      identifier: "broken",
      chat: climbing,
      direction: "incoming",
      timestamp: new Date("2026-09-18T13:00:00Z"),
      service: "iMessage",
      textUnreadable: {
        code: "message-text-unreadable",
        sentence:
          "This message's text could not be read from the store, so it is answered without it.",
      },
    });

    const result = await search({ query: "rope" });

    expect(result.structuredContent).toMatchObject({ coverage: { unsearched: 1 } });
  });

  it("given a chat identifier no chat has, refuses rather than reporting no matches", async () => {
    messageStore.holdsMessages(aMessage("here", climbing, "rope", "2026-09-18T14:00:00Z"));

    const result = await search({ query: "rope", chat: "iMessage;-;nobody" });

    expect(result.structuredContent).toMatchObject({ failure: { code: "chat-unknown" } });
  });

  // MSG-84: a search for nothing that found everything handed an agent the whole store.
  it("given an empty query, matches nothing, and scans nothing to find it", async () => {
    messageStore.holdsMessages(aMessage("here", climbing, "rope", "2026-09-18T14:00:00Z"));

    const result = await search({ query: "" });

    expect(result.structuredContent).toMatchObject({
      messages: [],
      coverage: { scanned: 0, matched: 0 },
    });
  });

  // #24: a search is never bounded silently. The maintainer set 50 as the most one returns.
  it("given more matches than it returns, returns the best 50 and says how many matched in all", async () => {
    messageStore.holdsMessages(
      ...Array.from({ length: 60 }, (_, index) =>
        aMessage(
          `m${String(index)}`,
          climbing,
          "rope",
          `2026-09-18T${String(10 + (index % 5))}:00:00Z`,
        ),
      ),
    );

    const result = await search({ query: "rope" });

    expect(result.structuredContent).toMatchObject({ coverage: { matched: 60 } });
    expect((result.structuredContent as { messages: unknown[] }).messages).toHaveLength(50);
  });

  // CONTEXT "Range": date-only bounds mean whole days in the user's time zone (MSG-77, MSG-78).
  it("given dates alone, searches those whole days in the user's time zone", async () => {
    messageStore.holdsMessages(aMessage("late", climbing, "rope", "2026-09-18T03:30:00Z"));

    const result = await search({ query: "rope", from: "2026-09-17", to: "2026-09-17" });

    expect(result.structuredContent).toMatchObject({
      range: { from: "2026-09-17T04:00:00.000Z", to: "2026-09-18T04:00:00.000Z" },
      messages: [{ identifier: "late" }],
    });
  });

  it("given only an end, searches the 30 days before it rather than a range that ends before it starts", async () => {
    const result = await search({ query: "rope", to: "2025-01-01T00:00:00Z" });

    expect(result.structuredContent).toMatchObject({
      range: { from: "2024-12-02T00:00:00.000Z", to: "2025-01-01T00:00:00.000Z" },
    });
  });

  it("given a range that ends before it starts, refuses it rather than finding nothing", async () => {
    const result = await search({ query: "rope", from: "2026-09-18", to: "2026-09-01" });

    expect(result.structuredContent).toMatchObject({ failure: { code: "range-not-forwards" } });
  });

  // MSG-79: a date the calendar does not have is refused, never rolled over into the next month.
  it("given a date the calendar does not have, refuses it", async () => {
    const result = await search({ query: "rope", from: "2026-02-30" });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
  });

  it("names the sender of each match the user's contacts hold", async () => {
    messageStore.holdsMessages(aMessage("one", climbing, "rope", "2026-09-18T14:00:00Z"));
    contactNames.knows("ben@example.com", "Ben Okafor");

    const result = await search({ query: "rope" });

    expect(result.structuredContent).toMatchObject({
      messages: [{ handle: "ben@example.com", name: "Ben Okafor" }],
    });
  });
});
