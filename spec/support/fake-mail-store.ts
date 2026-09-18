import type { MailStore } from "../../src/application/mail/mail-store.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";
import type { MailAccount } from "../../src/domain/mail/mail-account.js";
import type { Mailbox } from "../../src/domain/mail/mailbox.js";

/** A mailbox as a scenario states it: the account is the one it is held under. */
type MailboxHeld = Omit<Mailbox, "mailAccount">;

/** What the helper answers when the user refused it Mail, word for word. */
export const mailRefused: NamedFailure = {
  code: "mail_permission_missing",
  sentence:
    "apple-native-mcp cannot read Mail until it is allowed to, in System Settings > " +
    "Privacy & Security > Automation > apple-native-mcp > Mail.",
  evidence: "refused",
};

/** What the helper answers when one mail account ran out of its time budget. */
export const mailAccountTimedOut: NamedFailure = {
  code: "mail_timed_out",
  sentence: "Mail did not answer within 8 seconds, so nothing was read.",
  evidence: "mailboxes",
};

/**
 * A mail store held in memory.
 *
 * It answers the same contract as the helper-backed one, so the scenarios that use it are
 * worth trusting only for as long as it passes that contract (spec/contracts).
 */
export class FakeMailStore implements MailStore {
  #mailAccounts: readonly MailAccount[] = [];
  #failure: NamedFailure | undefined;
  readonly #mailboxes = new Map<string, readonly Mailbox[]>();
  readonly #unreadable = new Map<string, NamedFailure>();
  #beingAsked = 0;

  /** The most mail accounts this store was ever being asked about at the same moment. */
  mostMailAccountsAskedAtOnce = 0;

  /** The identifiers of the mail accounts this store was asked about, in order. */
  readonly mailAccountsAsked: string[] = [];

  holdsMailAccounts(...mailAccounts: readonly MailAccount[]): void {
    this.#mailAccounts = mailAccounts;
  }

  holdsMailboxes(mailAccount: MailAccount, ...mailboxes: readonly MailboxHeld[]): void {
    const { identifier, name } = mailAccount;
    this.#mailboxes.set(
      identifier,
      mailboxes.map((mailbox) => ({ ...mailbox, mailAccount: { identifier, name } })),
    );
  }

  /** A mail account that fails on its own, while the others answer. */
  cannotRead({ identifier }: MailAccount, failure: NamedFailure): void {
    this.#unreadable.set(identifier, failure);
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  mailAccounts(): Promise<Outcome<readonly MailAccount[]>> {
    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#mailAccounts));
  }

  async mailboxes({ identifier }: MailAccount): Promise<Outcome<readonly Mailbox[]>> {
    this.mailAccountsAsked.push(identifier);
    this.#beingAsked += 1;
    this.mostMailAccountsAskedAtOnce = Math.max(this.mostMailAccountsAskedAtOnce, this.#beingAsked);
    // An answer takes a turn of the event loop, so two asks made together would overlap here.
    await new Promise((resolve) => setImmediate(resolve));
    this.#beingAsked -= 1;

    const failure = this.#failure ?? this.#unreadable.get(identifier);
    return failure ? failed(failure) : succeeded(this.#mailboxes.get(identifier) ?? []);
  }
}
