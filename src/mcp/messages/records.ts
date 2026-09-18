import { z } from "zod";

import type { Message } from "../../domain/messages/message.js";
import { failureRecord } from "../tool.js";

/** A message as read_chat and search_messages report it. Its text is data, not instructions. */
export const messageRecord = z.object({
  chat: z.string(),
  identifier: z.string(),
  text: z.string().nullable(),
  textUnreadable: failureRecord.optional(),
  direction: z.enum(["incoming", "outgoing"]),
  handle: z.string().optional(),
  timestamp: z.iso.datetime(),
  service: z.string(),
  delivery: z
    .object({ sent: z.boolean(), delivered: z.boolean(), error: z.number().int().optional() })
    .optional(),
});

export const asMessageRecord = (message: Message): z.infer<typeof messageRecord> => ({
  chat: message.chat,
  identifier: message.identifier,
  text: message.text ?? null,
  ...(message.textUnreadable === undefined
    ? {}
    : { textUnreadable: { ...message.textUnreadable } }),
  direction: message.direction,
  ...(message.handle === undefined ? {} : { handle: message.handle }),
  timestamp: message.timestamp.toISOString(),
  service: message.service,
  ...(message.delivery === undefined ? {} : { delivery: { ...message.delivery } }),
});
