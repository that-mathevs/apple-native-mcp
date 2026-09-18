import { z } from "zod";

import {
  listChats,
  type ListChatsDependencies,
} from "../../application/messages/list-chats.js";
import type { Chat } from "../../domain/messages/chat.js";
import { greatestChatLimit } from "../../domain/messages/chat.js";
import type { Naming } from "../../application/messages/contact-names.js";
import { refusing, reporting } from "../result.js";
import { failureRecord, tool, type Tool } from "../tool.js";
import { asHandleRecord, handleRecord, namingCoverage } from "./records.js";

const chatRecord = z.object({
  identifier: z.string(),
  kind: z.enum(["one-to-one", "group"]),
  participants: z.array(handleRecord),
  lastTimestamp: z.iso.datetime(),
});

const asRecord = (chat: Chat, naming: Naming): z.infer<typeof chatRecord> => ({
  identifier: chat.identifier,
  kind: chat.kind,
  participants: chat.participants.map((handle) => asHandleRecord(handle, naming)),
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
      coverage: z.object({ truncated: z.boolean(), namesUnavailable: failureRecord.optional() }),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async (request) => {
      const listed = await listChats(dependencies, request);
      if (!listed.ok) return refusing(listed.failure);

      const { chats, truncated, naming } = listed.value;
      return reporting({
        chats: chats.map((chat) => asRecord(chat, naming)),
        coverage: { truncated, ...namingCoverage(naming) },
      });
    },
  });
