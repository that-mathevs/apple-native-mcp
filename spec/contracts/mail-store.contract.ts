import { describe, expect, it } from "vitest";

import type { MailStore } from "../../src/application/mail/mail-store.js";
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
  });
};
