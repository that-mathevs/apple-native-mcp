import type { NamedFailure } from "../failure.js";

/**
 * Whether a read of Mail failed because its time budget ran out: in the helper, whose
 * `mail_timed_out` reaches an agent as `mail-timed-out`, or on the way to it, where the server
 * gives up on a helper that has gone quiet and says `helper-timed-out`. Both are Mail not
 * answering, so the two codes are named in this one place.
 */
export const ranOutOfTime = ({ code }: NamedFailure): boolean =>
  code === "mail-timed-out" || code === "helper-timed-out";
