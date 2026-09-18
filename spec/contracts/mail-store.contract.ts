import { describe, expect, it } from "vitest";

import type { MailStore } from "../../src/application/mail/mail-store.js";
import { newestFirst, type Email } from "../../src/domain/mail/email.js";
import type { MailAccount } from "../../src/domain/mail/mail-account.js";
import { mailboxRoles, type Mailbox } from "../../src/domain/mail/mailbox.js";

/**
 * What every mail store promises, whichever way it reaches Mail.
 *
 * The scenarios hold for whatever mail accounts a store has, so the suite runs unchanged against
 * the fake everywhere and against this Mac's own Mail under `npm run spec:mac`.
 */
export type MailStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly mailStore: MailStore }>;
};

const accountsOf = async (mailStore: MailStore): Promise<readonly MailAccount[]> => {
  const accounts = await mailStore.mailAccounts();
  if (!accounts.ok) {
    throw new Error(`the mail accounts could not be read: ${accounts.failure.code}`);
  }
  return accounts.value;
};

const mailboxesOf = async (
  mailStore: MailStore,
  mailAccount: MailAccount,
): Promise<readonly Mailbox[]> => {
  const mailboxes = await mailStore.mailboxes(mailAccount);
  if (!mailboxes.ok) throw new Error(`the mailboxes could not be read: ${mailboxes.failure.code}`);
  return mailboxes.value;
};

export const aMailStore = ({ name, build }: MailStoreUnderTest): void => {
  describe(`${name}, as a mail store`, () => {
    it("names every mail account with an identifier, a name and its email addresses", async () => {
      const { mailStore } = await build();

      const accounts = await accountsOf(mailStore);

      expect(accounts.length).toBeGreaterThan(0);
      for (const account of accounts) {
        expect(account).toStrictEqual({
          identifier: expect.any(String) as string,
          name: expect.any(String) as string,
          emailAddresses: expect.any(Array) as string[],
        });
      }
    });

    it("gives no two mail accounts the same identifier: names repeat, so it is what addresses one", async () => {
      const { mailStore } = await build();

      const identifiers = (await accountsOf(mailStore)).map(({ identifier }) => identifier);

      expect(new Set(identifiers).size).toBe(identifiers.length);
    });

    it("answers for one mail account with that account's mailboxes only, each with a path of at least one name", async () => {
      const { mailStore } = await build();

      for (const account of await accountsOf(mailStore)) {
        for (const mailbox of await mailboxesOf(mailStore, account)) {
          expect(mailbox.mailAccount).toStrictEqual({
            identifier: account.identifier,
            name: account.name,
          });
          expect(mailbox.path.length).toBeGreaterThan(0);
        }
      }
    });

    // findings MAIL-69: an account and a path are what a later read addresses a mailbox by.
    it("gives no two mailboxes of one mail account the same path", async () => {
      const { mailStore } = await build();

      for (const account of await accountsOf(mailStore)) {
        const paths = (await mailboxesOf(mailStore, account)).map(({ path }) =>
          JSON.stringify(path),
        );

        expect(new Set(paths).size).toBe(paths.length);
      }
    });

    it("gives a mailbox a role only from the ones Mail knows, and each role to one mailbox of an account at most", async () => {
      const { mailStore } = await build();

      for (const account of await accountsOf(mailStore)) {
        const roles = (await mailboxesOf(mailStore, account)).flatMap(({ role }) =>
          role === undefined ? [] : [role],
        );

        expect(roles.filter((role) => !mailboxRoles.includes(role))).toStrictEqual([]);
        expect(new Set(roles).size).toBe(roles.length);
      }
    });
    /**
     * The first inbox that holds any email and can be read, with its newest emails. A mailbox too
     * large to read says so, which is an answer too: it is passed over for the next.
     */
    const anInboxWithMail = async (
      mailStore: MailStore,
    ): Promise<{ readonly inbox: Mailbox; readonly emails: readonly Email[] }> => {
      for (const account of await accountsOf(mailStore)) {
        const inbox = (await mailboxesOf(mailStore, account)).find(({ role }) => role === "inbox");
        if (inbox === undefined) continue;

        const latest = await mailStore.latestEmails({ mailbox: inbox, newest: 3 });
        if (!latest.ok && latest.failure.code === "mailbox_too_large") continue;
        if (!latest.ok)
          throw new Error(`the latest emails could not be read: ${latest.failure.code}`);
        if (latest.value.emails.length > 0) return { inbox, emails: latest.value.emails };
      }
      throw new Error("no mail account has an inbox with an email in it");
    };

    // brightline 0833904 took the first emails in mailbox order for the latest.
    it("gives a mailbox's latest emails newest first, no more than were asked for, each in the mailbox asked about", async () => {
      const { mailStore } = await build();

      const { inbox, emails } = await anInboxWithMail(mailStore);

      expect(emails.length).toBeLessThanOrEqual(3);
      expect([...emails].sort(newestFirst)).toStrictEqual(emails);
      for (const email of emails) {
        expect(email).toStrictEqual({
          mailbox: { mailAccount: inbox.mailAccount, path: inbox.path },
          storeIdentifier: expect.any(Number) as number,
          subject: expect.any(String) as string,
          sender: expect.any(String) as string,
          receivedAt: expect.any(Date) as Date,
          isRead: expect.any(Boolean) as boolean,
        });
      }
    });

    it("given a range, answers only with emails received inside it, and says whether the ceiling stopped it short", async () => {
      const { mailStore } = await build();
      const { inbox, emails } = await anInboxWithMail(mailStore);
      const [newest] = emails;
      if (!newest) throw new Error("the inbox held no email after all");
      const range = {
        from: new Date(newest.receivedAt.getTime() - 24 * 60 * 60 * 1000),
        to: new Date(newest.receivedAt.getTime() + 1000),
      };

      const read = await mailStore.emailsInRange({ mailbox: inbox, range, ceiling: 1 });

      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.emails).toHaveLength(1);
      expect(read.value.truncated).toStrictEqual(expect.any(Boolean));
      for (const { receivedAt } of read.value.emails) {
        expect(receivedAt >= range.from && receivedAt < range.to).toBe(true);
      }
    });

    // findings MAIL-C7: a later read acts on exactly this email, by its Message-ID.
    it("gives each email asked about its Message-ID, and none for an email that is not there", async () => {
      const { mailStore } = await build();
      const { inbox, emails } = await anInboxWithMail(mailStore);
      const storeIdentifiers = emails.map(({ storeIdentifier }) => storeIdentifier);
      const notThere = 2_000_000_000;

      const read = await mailStore.messageIds({
        mailbox: inbox,
        storeIdentifiers: [...storeIdentifiers, notThere],
      });

      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect([...read.value.keys()].sort()).toStrictEqual([...storeIdentifiers].sort());
      for (const messageId of read.value.values()) expect(messageId.length).toBeGreaterThan(0);
    });

    it("reads bodies only for the emails asked about, each as text", async () => {
      const { mailStore } = await build();
      const { inbox, emails } = await anInboxWithMail(mailStore);
      const [newest] = emails;
      if (!newest) throw new Error("the inbox held no email after all");

      const read = await mailStore.emailBodies({
        mailbox: inbox,
        storeIdentifiers: [newest.storeIdentifier],
      });

      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect([...read.value.keys()]).toStrictEqual([newest.storeIdentifier]);
      expect(read.value.get(newest.storeIdentifier)).toStrictEqual(expect.any(String));
    });
  });
};
