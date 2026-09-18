import type { NamedFailure } from "../failure.js";

/**
 * Whether a read of Mail failed because its time budget ran out: in the helper, which says
 * `mail_timed_out`, or on the way to it, where the server gives up on a helper that has gone
 * quiet and says `helper-timed-out`. Both are Mail not answering, and the codes are the helper
 * protocol's and the server's own (native/README.md), so they are named in this one place.
 */
export const ranOutOfTime = ({ code }: NamedFailure): boolean =>
  code === "mail_timed_out" || code === "helper-timed-out";
