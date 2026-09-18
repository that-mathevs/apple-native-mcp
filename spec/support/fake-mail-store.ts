import type {
  EmailBodies,
  EmailsInRange,
  EmailsInRangeWanted,
  LatestEmails,
  LatestEmailsWanted,
  MailStore,
  EmailsAskedAbout,
} from "../../src/application/mail/mail-store.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";
import { newestFirst, type Email } from "../../src/domain/mail/email.js";
import type { MailAccount } from "../../src/domain/mail/mail-account.js";
import type { Mailbox, MailboxAddress } from "../../src/domain/mail/mailbox.js";

/** A mailbox as a scenario states it: the account is the one it is held under. */
type MailboxHeld = Omit<Mailbox, "mailAccount">;

/**
 * An email as a scenario states it: the mailbox is the one it is held in, and the store gives it
 * its own identifier.
 */
type EmailHeld = Omit<Email, "mailbox" | "storeIdentifier"> & {
  readonly messageId: string;
  readonly body: string;
  /** Deleted after it was listed and before anything more could be read of it. */
  readonly goesBeforeItsMessageIdIsRead: boolean;
};

/** An email with this subject, and whatever else a scenario's behaviour reads. */
export const anEmail = (
  subject: string,
  {
    receivedAt,
    ...rest
  }: Partial<Omit<EmailHeld, "subject" | "receivedAt">> & {
    readonly receivedAt: string;
  },
): EmailHeld => ({
  subject,
  sender: "Sam Okafor <sam@example.test>",
  isRead: false,
  messageId: `<${subject.toLowerCase().replaceAll(" ", "-")}@example.test>`,
  body: "",
  goesBeforeItsMessageIdIsRead: false,
  receivedAt: new Date(receivedAt),
  ...rest,
});

const mailboxKey = ({ mailAccount, path }: MailboxAddress): string =>
  JSON.stringify([mailAccount.identifier, path]);

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
  readonly #emails = new Map<string, readonly (Email & EmailHeld)[]>();
  #nextStoreIdentifier = 1;

  readonly #unsearchable = new Map<string, NamedFailure>();
  readonly #unreferenceable = new Map<string, NamedFailure>();
  readonly #bodiesUnreadable = new Map<string, NamedFailure>();
  readonly #undated = new Map<string, number>();

  /** Called after each mailbox is searched, so a scenario can let time pass. */
  afterSearchingAMailbox: () => void = () => undefined;

  /** The mailboxes this store was asked to search, in order, each as its account and path. */
  readonly mailboxesSearched: string[] = [];

  #bodiesReadInTime = Number.POSITIVE_INFINITY;

  /** How many bodies this store has read. */
  bodiesRead = 0;

  #answersNothingAfterATimeout = false;
  #timedOut = false;

  /** How many Message-IDs this store has been asked for. */
  messageIdsRead = 0;
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

  /** Emails in one mailbox, kept in the order given, as a mailbox keeps whatever order it has. */
  holdsEmails(
    { identifier, name }: MailAccount,
    { path }: MailboxHeld,
    ...emails: readonly EmailHeld[]
  ): void {
    const mailbox = { mailAccount: { identifier, name }, path };
    this.#emails.set(
      mailboxKey(mailbox),
      emails.map((email) => ({
        ...email,
        mailbox,
        storeIdentifier: (this.#nextStoreIdentifier += 1),
      })),
    );
  }

  /** Once any read has run out of its time budget, Mail leaves even a small question unanswered. */
  answersNothingAfterATimeout(): void {
    this.#answersNothingAfterATimeout = true;
  }

  /** How many bodies one request reads, newest first, before its time budget ends it. */
  readsThisManyBodiesInTime(bodies: number): void {
    this.#bodiesReadInTime = bodies;
  }

  /** A mailbox whose emails answer, and whose Message-IDs do not. */
  cannotReadMessageIds(
    { identifier, name }: MailAccount,
    { path }: MailboxHeld,
    failure: NamedFailure,
  ): void {
    this.#unreferenceable.set(mailboxKey({ mailAccount: { identifier, name }, path }), failure);
  }

  /** A mailbox whose emails answer, and whose bodies do not. */
  cannotReadBodies(
    { identifier, name }: MailAccount,
    { path }: MailboxHeld,
    failure: NamedFailure,
  ): void {
    this.#bodiesUnreadable.set(mailboxKey({ mailAccount: { identifier, name }, path }), failure);
  }

  /** Emails Mail gives no received date, which no range can hold. */
  holdsUndatedEmails(
    { identifier, name }: MailAccount,
    { path }: MailboxHeld,
    emails: number,
  ): void {
    this.#undated.set(mailboxKey({ mailAccount: { identifier, name }, path }), emails);
  }

  /** A mailbox that fails on its own, while the account's others answer. */
  cannotSearch(
    { identifier, name }: MailAccount,
    { path }: MailboxHeld,
    failure: NamedFailure,
  ): void {
    this.#unsearchable.set(mailboxKey({ mailAccount: { identifier, name }, path }), failure);
  }

  /** A mail account that fails on its own, while the others answer. */
  cannotRead({ identifier }: MailAccount, failure: NamedFailure): void {
    this.#unreadable.set(identifier, failure);
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  mailAccounts(): Promise<Outcome<readonly MailAccount[]>> {
    if (this.#answersNothingAfterATimeout && this.#timedOut) {
      return Promise.resolve(failed(mailAccountTimedOut));
    }
    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#mailAccounts));
  }

  /** Remembers that a read ran out of its time budget, as a Mail kept busy by one would be. */
  #answering<Read>(outcome: Outcome<Read>): Outcome<Read> {
    if (!outcome.ok && outcome.failure.code === mailAccountTimedOut.code) this.#timedOut = true;
    return outcome;
  }

  async mailboxes({ identifier }: MailAccount): Promise<Outcome<readonly Mailbox[]>> {
    this.mailAccountsAsked.push(identifier);
    this.#beingAsked += 1;
    this.mostMailAccountsAskedAtOnce = Math.max(this.mostMailAccountsAskedAtOnce, this.#beingAsked);
    // An answer takes a turn of the event loop, so two asks made together would overlap here.
    await new Promise((resolve) => setImmediate(resolve));
    this.#beingAsked -= 1;

    const failure = this.#failure ?? this.#unreadable.get(identifier);
    return this.#answering(
      failure ? failed(failure) : succeeded(this.#mailboxes.get(identifier) ?? []),
    );
  }

  latestEmails({ mailbox, newest }: LatestEmailsWanted): Promise<Outcome<LatestEmails>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    return Promise.resolve(
      succeeded({
        emails: this.#newestFirstIn(mailbox).slice(0, newest),
        undated: this.#undated.get(mailboxKey(mailbox)) ?? 0,
      }),
    );
  }

  emailsInRange({ mailbox, range, ceiling }: EmailsInRangeWanted): Promise<Outcome<EmailsInRange>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    this.mailboxesSearched.push(`${mailbox.mailAccount.name}/${mailbox.path.join("/")}`);
    const unsearchable = this.#unsearchable.get(mailboxKey(mailbox));
    if (unsearchable) return Promise.resolve(this.#answering(failed(unsearchable)));

    this.afterSearchingAMailbox();
    const inRange = this.#newestFirstIn(mailbox).filter(
      ({ receivedAt }) => receivedAt >= range.from && receivedAt < range.to,
    );
    return Promise.resolve(
      succeeded({
        emails: inRange.slice(0, ceiling),
        truncated: inRange.length > ceiling,
        undated: this.#undated.get(mailboxKey(mailbox)) ?? 0,
      }),
    );
  }

  #newestFirstIn(mailbox: MailboxAddress): Email[] {
    const emails = this.#emails.get(mailboxKey(mailbox)) ?? [];
    return [...emails]
      .sort(newestFirst)
      .map(({ mailbox: held, storeIdentifier, subject, sender, receivedAt, isRead }) => ({
        mailbox: held,
        storeIdentifier,
        subject,
        sender,
        receivedAt,
        isRead,
      }));
  }

  emailBodies({ mailbox, storeIdentifiers }: EmailsAskedAbout): Promise<Outcome<EmailBodies>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));
    const unreadable = this.#bodiesUnreadable.get(mailboxKey(mailbox));
    if (unreadable) return Promise.resolve(failed(unreadable));

    const read = [...(this.#emails.get(mailboxKey(mailbox)) ?? [])]
      .filter(({ storeIdentifier }) => storeIdentifiers.includes(storeIdentifier))
      .sort(newestFirst)
      .slice(0, this.#bodiesReadInTime);
    this.bodiesRead += read.length;
    return Promise.resolve(
      succeeded(new Map(read.map(({ storeIdentifier, body }) => [storeIdentifier, body]))),
    );
  }

  messageIds({
    mailbox,
    storeIdentifiers,
  }: EmailsAskedAbout): Promise<Outcome<ReadonlyMap<number, string>>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const unreferenceable = this.#unreferenceable.get(mailboxKey(mailbox));
    if (unreferenceable) return Promise.resolve(failed(unreferenceable));

    this.messageIdsRead += storeIdentifiers.length;
    const held = this.#emails.get(mailboxKey(mailbox)) ?? [];
    return Promise.resolve(
      succeeded(
        new Map(
          held
            .filter(
              ({ storeIdentifier, goesBeforeItsMessageIdIsRead }) =>
                storeIdentifiers.includes(storeIdentifier) && !goesBeforeItsMessageIdIsRead,
            )
            .map(({ storeIdentifier, messageId }) => [storeIdentifier, messageId]),
        ),
      ),
    );
  }
}
