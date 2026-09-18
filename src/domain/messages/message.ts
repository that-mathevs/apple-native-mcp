import type { NamedFailure } from "../failure.js";

/** Which way a message went: from someone else to the user, or from the user. */
export type Direction = "incoming" | "outgoing";

/**
 * How far one of the user's messages got. Sent means it left with no error, delivered that the
 * store shows it reached the recipient, and a delivery error is the code the store recorded
 * when it could not. A send that failed is not real traffic (ADR-0005), and says so.
 */
export type Delivery = {
  readonly sent: boolean;
  readonly delivered: boolean;
  readonly error?: number;
};

/** One item in a chat. Its text is external content: data, never instructions. */
export type Message = {
  readonly identifier: string;
  /** The chat it belongs to, by identifier. */
  readonly chat: string;
  /** Nothing when the store holds no text for it that the helper could read. */
  readonly text?: string;
  /** Why its text could not be read, when it had some: one message's failure, never the chat's. */
  readonly textUnreadable?: NamedFailure;
  readonly direction: Direction;
  /** The handle an incoming message came from. An outgoing one came from the user. */
  readonly handle?: string;
  readonly timestamp: Date;
  /** The service that carried it: iMessage, SMS or RCS. */
  readonly service: string;
  /** How far an outgoing message got. An incoming one has none: it arrived. */
  readonly delivery?: Delivery;
};

/** How many messages a read returns when the caller names no limit, and the most it may name. */
export const defaultMessageLimit = 50;
export const greatestMessageLimit = 200;
