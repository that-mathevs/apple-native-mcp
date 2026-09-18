import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeContactNames } from "../../support/fake-contact-names.js";
import { contactsRefused } from "../../support/fake-contact-store.js";
import {
  FakeMessageStore,
  messageStoreNotFound,
  messageStorePermissionMissing,
  messageStoreUnreadable,
} from "../../support/fake-message-store.js";

const withAnna = {
  identifier: "iMessage;-;+15551230001",
  kind: "one-to-one",
  participants: ["+15551230001"],
  lastTimestamp: new Date("2026-09-18T15:00:00Z"),
} as const;

const climbing = {
  identifier: "iMessage;+;chat001",
  kind: "group",
  participants: ["+15551230001", "ben@example.com"],
  lastTimestamp: new Date("2026-09-18T15:30:00Z"),
} as const;

describe("listing chats", () => {
  let messageStore: FakeMessageStore;
  let contactNames: FakeContactNames;
  let client: Client;

  const listChats = async (args: Record<string, unknown> = {}): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_chats", arguments: args });

  beforeEach(async () => {
    messageStore = new FakeMessageStore();
    contactNames = new FakeContactNames();
    client = await connectedTo(aServer({ messageStore, contactNames }));
  });

  // User story 24: a reply meant for one person must not land in a group by accident.
  it("returns one entry per chat, newest first, each with its kind and its participants' handles", async () => {
    messageStore.holdsChats(withAnna, climbing);

    const result = await listChats();

    expect(result.structuredContent).toStrictEqual({
      chats: [
        {
          identifier: "iMessage;+;chat001",
          kind: "group",
          participants: [{ handle: "+15551230001" }, { handle: "ben@example.com" }],
          lastTimestamp: "2026-09-18T15:30:00.000Z",
        },
        {
          identifier: "iMessage;-;+15551230001",
          kind: "one-to-one",
          participants: [{ handle: "+15551230001" }],
          lastTimestamp: "2026-09-18T15:00:00.000Z",
        },
      ],
      coverage: { truncated: false },
    });
  });

  it("given more chats than the limit, returns the newest and says the list is truncated", async () => {
    messageStore.holdsChats(withAnna, climbing);

    const result = await listChats({ limit: 1 });

    expect(result.structuredContent).toMatchObject({
      chats: [{ identifier: "iMessage;+;chat001" }],
      coverage: { truncated: true },
    });
  });

  // Upstream #66 and #62: every failure to read the store came back as no messages at all, and
  // one check blamed a missing permission for every cause (faces-sh 42c2fd7).
  it("given the store may not be read, refuses and names the setting to enable, never reporting no chats", async () => {
    messageStore.refuses(messageStorePermissionMissing);

    const result = await listChats();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "message_store_permission_missing",
        sentence: expect.stringContaining("Privacy & Security > Full Disk Access") as string,
      },
    });
  });

  it("given no message store on this Mac, refuses as not found rather than as a missing permission", async () => {
    messageStore.refuses(messageStoreNotFound);

    const result = await listChats();

    expect(result.structuredContent).toMatchObject({
      failure: { code: "message_store_not_found" },
    });
  });

  it("given a store that is there but cannot be opened, refuses with what the store said", async () => {
    messageStore.refuses(messageStoreUnreadable);

    const result = await listChats();

    expect(result.structuredContent).toMatchObject({
      failure: { code: "message_store_unreadable", evidence: "file is not a database" },
    });
  });

  it("names each participant the user's contacts hold, and leaves the rest as handles", async () => {
    messageStore.holdsChats(climbing);
    contactNames.knows("+15551230001", "Anna Reyes");

    const result = await listChats();

    expect(result.structuredContent).toMatchObject({
      chats: [
        {
          participants: [
            { handle: "+15551230001", name: "Anna Reyes" },
            { handle: "ben@example.com" },
          ],
        },
      ],
    });
  });

  // MSG-16: upstream answered "nobody by that name" when it was Contacts that could not be read.
  it("given contacts cannot be read, still lists the chats under their handles and says names were unavailable", async () => {
    messageStore.holdsChats(climbing);
    contactNames.refuses(contactsRefused);

    const result = await listChats();

    expect(result.structuredContent).toMatchObject({
      chats: [{ participants: [{ handle: "+15551230001" }, { handle: "ben@example.com" }] }],
      coverage: { namesUnavailable: { code: "contacts_permission_missing" } },
    });
  });

  // MSG-15 and upstream #58: one read of the whole address book per participant took minutes.
  it("reads the contacts once for the whole list, however many participants it names", async () => {
    messageStore.holdsChats(withAnna, climbing);

    await listChats();

    expect(contactNames.reads).toBe(1);
  });

  // MSG-C12: a contact added a moment ago must be named, so nothing is kept between calls.
  it("given a contact added since the last call, names them: names are never kept between calls", async () => {
    messageStore.holdsChats(withAnna);
    await listChats();
    contactNames.knows("+15551230001", "Anna Reyes");

    const result = await listChats();

    expect(result.structuredContent).toMatchObject({
      chats: [{ participants: [{ handle: "+15551230001", name: "Anna Reyes" }] }],
    });
  });
});
