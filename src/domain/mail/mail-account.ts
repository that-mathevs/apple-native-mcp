import type { NamedFailure, Outcome } from "../failure.js";
import { failed, succeeded } from "../failure.js";

/**
 * A configured account in Mail. Display names aren't unique, so the identifier Mail gives the
 * account is what addresses it.
 */
export type MailAccount = {
  readonly identifier: string;
  readonly name: string;
  readonly emailAddresses: readonly string[];
};

/** An email address as mail compares it: without regard to case. */
const sameAddress = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

/**
 * The mail accounts a caller's word could mean: the one with that identifier, which never
 * repeats, or else every one with that exact name or with that email address. A person says "my
 * work address" and never a UUID (ANierbeck 3005df4), and a name is whatever they typed into
 * Mail, so two mail accounts may share one.
 */
const mailAccountsNamed = (
  mailAccounts: readonly MailAccount[],
  asked: string,
): readonly MailAccount[] => {
  const byIdentifier = mailAccounts.filter(({ identifier }) => identifier === asked);
  if (byIdentifier.length > 0) return byIdentifier;

  return mailAccounts.filter(
    (mailAccount) =>
      mailAccount.name === asked ||
      mailAccount.emailAddresses.some((address) => sameAddress(address, asked)),
  );
};

/**
 * The one mail account a name means, or the refusal saying why there isn't one, which begins with
 * what did not happen: nothing is ever read from a mail account that was guessed at, and choosing
 * between two is the caller's to do. What was asked and the mail accounts that answer to it
 * travel as a record, because a name is text the user wrote (ADR-0006).
 */
export const theMailAccountNamed = (
  mailAccounts: readonly MailAccount[],
  asked: string,
  whatDidNotHappen: string,
): Outcome<MailAccount> => {
  const named = mailAccountsNamed(mailAccounts, asked);
  const [only] = named;
  if (named.length === 1 && only !== undefined) return succeeded(only);

  const refusal = (
    code: string,
    sentence: string,
    listed: readonly MailAccount[],
  ): NamedFailure => ({
    code,
    sentence: `${whatDidNotHappen} ${sentence}`,
    evidence: JSON.stringify({ asked, mailAccounts: listed }),
  });

  return failed(
    named.length === 0
      ? refusal(
          "mail-account-unknown",
          "No mail account has that identifier, that name or that email address.",
          mailAccounts,
        )
      : refusal(
          "mail-account-ambiguous",
          "More than one mail account has that name or that email address, so ask by identifier.",
          named,
        ),
  );
};
