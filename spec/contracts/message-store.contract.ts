import { describe, expect, it } from "vitest";

import type { MessageStore } from "../../src/application/messages/message-store.js";
import type { Chat } from "../../src/domain/messages/chat.js";
import type { Message } from "../../src/domain/messages/message.js";

/**
 * What every message store promises, whichever way it reaches the store.
 *
 * The fake behind the acceptance scenarios is only worth trusting while it answers the same
 * contract as the helper-backed one. Only the fake can be loaded with chats: the real store is
 * the user's own, so it answers the part of the contract that holds whatever it contains.
 */
export type MessageStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly messageStore: MessageStore }>;
};

export type LoadableMessageStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{
    readonly messageStore: MessageStore;
    readonly holding: (chats: readonly Chat[], messages: readonly Message[]) => Promise<void>;
  }>;
};

const aChat = (identifier: string, lastTimestamp: string): Chat => ({
  identifier,
  kind: "one-to-one",
  participants: ["+15551230001"],
  lastTimestamp: new Date(lastTimestamp),
});

const aMessage = (identifier: string, chat: string, timestamp: string): Message => ({
  identifier,
  chat,
  text: identifier,
  direction: "incoming",
  handle: "+15551230001",
  timestamp: new Date(timestamp),
  service: "iMessage",
});

export const aMessageStore = ({ name, build }: MessageStoreUnderTest): void => {
  describe(`${name}, as a message store`, () => {
    it("answers chats newest first, never more than asked, and says whether there were more", async () => {
      const { messageStore } = await build();

      const read = await messageStore.chats(3);

      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const times = read.value.chats.map(({ lastTimestamp }) => lastTimestamp.getTime());
      expect(times).toStrictEqual([...times].sort((left, right) => right - left));
      expect(read.value.chats.length).toBeLessThanOrEqual(3);
      expect(typeof read.value.truncated).toBe("boolean");
    });

    it("given a chat identifier no chat has, refuses it as unknown rather than answering with no messages", async () => {
      const { messageStore } = await build();

      const read = await messageStore.messages({ chat: "iMessage;-;no-such-chat", limit: 5 });

      expect(read).toMatchObject({ ok: false, failure: { code: "chat_unknown" } });
    });
  });
};

export const aMessageStoreThatCanBeLoaded = ({
  name,
  build,
}: LoadableMessageStoreUnderTest): void => {
  describe(`${name}, loaded with chats`, () => {
    it("given more chats than asked for, answers the newest and says it is truncated", async () => {
      const { messageStore, holding } = await build();
      await holding(
        [aChat("older", "2026-09-17T10:00:00Z"), aChat("newer", "2026-09-18T10:00:00Z")],
        [],
      );

      expect(await messageStore.chats(1)).toMatchObject({
        ok: true,
        value: { chats: [{ identifier: "newer" }], truncated: true },
      });
    });

    it("answers a chat's newest messages oldest first, and says whether older ones were left", async () => {
      const { messageStore, holding } = await build();
      await holding(
        [aChat("chat", "2026-09-18T12:00:00Z")],
        [
          aMessage("third", "chat", "2026-09-18T12:00:00Z"),
          aMessage("first", "chat", "2026-09-18T10:00:00Z"),
          aMessage("second", "chat", "2026-09-18T11:00:00Z"),
        ],
      );

      expect(await messageStore.messages({ chat: "chat", limit: 2 })).toMatchObject({
        ok: true,
        value: { messages: [{ identifier: "second" }, { identifier: "third" }], truncated: true },
      });
    });

    it("given a range, answers only the messages from its first instant up to, not including, its end", async () => {
      const { messageStore, holding } = await build();
      await holding(
        [aChat("chat", "2026-09-18T12:00:00Z")],
        [
          aMessage("before", "chat", "2026-09-18T09:59:59Z"),
          aMessage("at-start", "chat", "2026-09-18T10:00:00Z"),
          aMessage("at-end", "chat", "2026-09-18T11:00:00Z"),
        ],
      );

      const read = await messageStore.messages({
        chat: "chat",
        limit: 10,
        from: new Date("2026-09-18T10:00:00Z"),
        to: new Date("2026-09-18T11:00:00Z"),
      });

      expect(read).toMatchObject({ ok: true, value: { messages: [{ identifier: "at-start" }] } });
    });
  });
};
