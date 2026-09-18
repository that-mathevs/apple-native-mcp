import type { NamedFailure } from "../../domain/failure.js";
import { ranOutOfTime } from "../../domain/mail/time-budget.js";
import type { MailStore } from "./mail-store.js";

/**
 * Whether Mail is taken to be busy after this failure, in which case nothing more is asked of it.
 *
 * A read that ran out of its time budget is, on its own, a slow mailbox: on a real Mac an inbox
 * of 76,000 emails ran out of time and Mail answered the next request in a fifth of a second, and
 * two large mailboxes next to each other both ran out while everything after them was healthy.
 * So Mail is asked something small, its mail accounts, which it answers in a sixth of a second.
 * A Mail that leaves that unanswered too has stopped answering, which #7 measured lasting two to
 * four minutes, and every further read would only wait out another whole time budget.
 */
export const mailIsBusyAfter = async (
  mailStore: MailStore,
  failure: NamedFailure,
): Promise<boolean> => {
  if (!ranOutOfTime(failure)) return false;

  const small = await mailStore.mailAccounts();
  return !small.ok && ranOutOfTime(small.failure);
};
