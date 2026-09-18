import { z } from "zod";

import type { Naming } from "../../application/messages/contact-names.js";
import type { NamedFailure } from "../../domain/failure.js";
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
  /** The name the user's contacts give the handle an incoming message came from. */
  name: z.string().optional(),
  timestamp: z.iso.datetime(),
  service: z.string(),
  delivery: z
    .object({ sent: z.boolean(), delivered: z.boolean(), error: z.number().int().optional() })
    .optional(),
});

export const asMessageRecord = (
  message: Message,
  naming: Naming,
): z.infer<typeof messageRecord> => ({
  chat: message.chat,
  identifier: message.identifier,
  text: message.text ?? null,
  ...(message.textUnreadable === undefined
    ? {}
    : { textUnreadable: { ...message.textUnreadable } }),
  direction: message.direction,
  ...(message.handle === undefined ? {} : asHandleRecord(message.handle, naming)),
  timestamp: message.timestamp.toISOString(),
  service: message.service,
  ...(message.delivery === undefined ? {} : { delivery: { ...message.delivery } }),
});

/** A handle, and the name the user's contacts give it when exactly one contact holds it. */
export const handleRecord = z.object({ handle: z.string(), name: z.string().optional() });

export const asHandleRecord = (
  handle: string,
  naming: Naming,
): z.infer<typeof handleRecord> => {
  const name = "names" in naming ? naming.names.get(handle) : undefined;
  return name === undefined ? { handle } : { handle, name };
};

/** Why no handle carries a name, when the contacts could not be read. */
export const namingCoverage = (naming: Naming): { namesUnavailable?: NamedFailure } =>
  "unavailable" in naming ? { namesUnavailable: naming.unavailable } : {};
