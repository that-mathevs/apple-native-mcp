import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeContactNames } from "../../support/fake-contact-names.js";
import { contactsRefused } from "../../support/fake-contact-store.js";
import { FakeMessageStore } from "../../support/fake-message-store.js";

const climbing = "iMessage;+;chat001";

const fromBen = {
  identifier: "message-1",
  chat: climbing,
  text: "Wall at 6?",
  direction: "incoming",
  handle: "ben@example.com",
  timestamp: new Date("2026-09-18T15:00:00Z"),
  service: "iMessage",
} as const;

const fromUser = {
  identifier: "message-2",
  chat: climbing,
  text: "I'm in",
  direction: "outgoing",
  timestamp: new Date("2026-09-18T15:05:00Z"),
  service: "iMessage",
  delivery: { sent: true, delivered: true },
} as const;

describe("reading a chat", () => {
  let messageStore: FakeMessageStore;
  let contactNames: FakeContactNames;
  let client: Client;

  const readChat = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "read_chat", arguments: args });

  beforeEach(async () => {
    messageStore = new FakeMessageStore();
    contactNames = new FakeContactNames();
    client = await connectedTo(aServer({ messageStore, contactNames }));
  });

  // Upstream #62 matched messages by handle alone, which dropped everything the user sent and
  // every group chat; a chat is the unit, and both sides of it are read (MSG-C3).
  it("returns the chat's messages from both sides in time order, each with its text, direction, timestamp, service and, for the user's, how far it got", async () => {
    messageStore.holdsMessages(fromUser, fromBen);

    const result = await readChat({ chat: climbing });

    expect(result.structuredContent).toStrictEqual({
      chat: climbing,
      messages: [
        {
          chat: climbing,
          identifier: "message-1",
          text: "Wall at 6?",
          direction: "incoming",
          handle: "ben@example.com",
          timestamp: "2026-09-18T15:00:00.000Z",
          service: "iMessage",
        },
        {
          chat: climbing,
          identifier: "message-2",
          text: "I'm in",
          direction: "outgoing",
          timestamp: "2026-09-18T15:05:00.000Z",
          service: "iMessage",
          delivery: { sent: true, delivered: true },
        },
      ],
      coverage: { truncated: false },
    });
  });

  it("given more messages than the limit, returns the newest in time order and says older ones were left", async () => {
    messageStore.holdsMessages(fromUser, fromBen);

    const result = await readChat({ chat: climbing, limit: 1 });

    expect(result.structuredContent).toMatchObject({
      messages: [{ identifier: "message-2" }],
      coverage: { truncated: true },
    });
  });

  // faces-sh 1fa9dc5: a read over a range said which range it had understood, so a short answer
  // could be told from a quiet week.
  it("given a range, returns only the messages inside it and says which range it read", async () => {
    messageStore.holdsMessages(fromUser, fromBen);

    const result = await readChat({
      chat: climbing,
      from: "2026-09-18T15:01:00Z",
      to: "2026-09-18T16:00:00Z",
    });

    expect(result.structuredContent).toMatchObject({
      messages: [{ identifier: "message-2" }],
      range: { from: "2026-09-18T15:01:00.000Z", to: "2026-09-18T16:00:00.000Z" },
    });
  });

  it("given a chat identifier no chat has, refuses rather than reporting no messages", async () => {
    messageStore.holdsMessages(fromBen);

    const result = await readChat({ chat: "iMessage;-;nobody" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ failure: { code: "chat_unknown" } });
  });

  // ADR-0005: a failed send is not real traffic. Shown as a plain outgoing message, it would read
  // as something the other person received.
  it("given one of the user's sends that failed, says it was not sent and gives its delivery error", async () => {
    messageStore.holdsMessages({
      ...fromUser,
      delivery: { sent: false, delivered: false, error: 22 },
    });

    const result = await readChat({ chat: climbing });

    expect(result.structuredContent).toMatchObject({
      messages: [
        { direction: "outgoing", delivery: { sent: false, delivered: false, error: 22 } },
      ],
    });
  });

  // #21: an archive a stranger wrote can be broken on purpose. It costs that one message its
  // text, named, and never the rest of the chat.
  it("given a message whose text could not be read, returns it without text, says why, and returns the rest", async () => {
    const { identifier, chat, direction, handle, timestamp, service } = fromBen;
    messageStore.holdsMessages(fromUser, {
      identifier,
      chat,
      direction,
      handle,
      timestamp,
      service,
      textUnreadable: {
        code: "message_text_unreadable",
        sentence:
          "This message's text could not be read from the store, so it is answered without it.",
        evidence: "the archive ends inside a value",
      },
    });

    const result = await readChat({ chat: climbing });

    expect(result.structuredContent).toMatchObject({
      messages: [
        {
          identifier: "message-1",
          text: null,
          textUnreadable: {
            code: "message_text_unreadable",
            evidence: "the archive ends inside a value",
          },
        },
        { identifier: "message-2", text: "I'm in" },
      ],
    });
  });

  it("names the sender of each incoming message the user's contacts hold", async () => {
    messageStore.holdsMessages(fromUser, fromBen);
    contactNames.knows("ben@example.com", "Ben Okafor");

    const result = await readChat({ chat: climbing });

    expect(result.structuredContent).toMatchObject({
      messages: [{ handle: "ben@example.com", name: "Ben Okafor" }, { direction: "outgoing" }],
    });
  });

  // MSG-16: messages are still read when it is Contacts that cannot be.
  it("given contacts cannot be read, returns the messages under their handles and says names were unavailable", async () => {
    messageStore.holdsMessages(fromBen);
    contactNames.refuses(contactsRefused);

    const result = await readChat({ chat: climbing });

    expect(result.structuredContent).toMatchObject({
      messages: [{ handle: "ben@example.com" }],
      coverage: { contactNamesUnavailable: { code: "contacts_permission_missing" } },
    });
  });
});
