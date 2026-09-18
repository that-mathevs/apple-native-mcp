import { z } from "zod";

import {
  listChats,
  type ListChatsDependencies,
} from "../../application/messages/list-chats.js";
import type { Chat } from "../../domain/messages/chat.js";
import { greatestChatLimit } from "../../domain/messages/chat.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";

const chatRecord = z.object({
  identifier: z.string(),
  kind: z.enum(["one-to-one", "group"]),
  participants: z.array(z.object({ handle: z.string() })),
  lastTimestamp: z.iso.datetime(),
});

const asRecord = (chat: Chat): z.infer<typeof chatRecord> => ({
  identifier: chat.identifier,
  kind: chat.kind,
  participants: chat.participants.map((handle) => ({ handle })),
  lastTimestamp: chat.lastTimestamp.toISOString(),
});

export const listChatsTool = (dependencies: ListChatsDependencies): Tool =>
  tool({
    name: "list_chats",
    title: "List chats",
    description:
      "The most recent chats in Messages, newest first, each with the identifier that " +
      "addresses it, whether it is a one-to-one chat or a group chat, and its participants.",
    input: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(greatestChatLimit)
        .optional()
        .describe("How many chats to return, newest first."),
    },
    output: {
      chats: z.array(chatRecord),
      coverage: z.object({ truncated: z.boolean() }),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async (request) => {
      const listed = await listChats(dependencies, request);
      if (!listed.ok) return refusing(listed.failure);

      const { chats, truncated } = listed.value;
      return reporting({ chats: chats.map(asRecord), coverage: { truncated } });
    },
  });
