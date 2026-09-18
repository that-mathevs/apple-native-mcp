import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeMailStore, mailAccountTimedOut, mailRefused } from "../../support/fake-mail-store.js";

const personal = {
  identifier: "account-personal",
  name: "Personal",
  emailAddresses: ["ada@example.test"],
} as const;

const work = {
  identifier: "account-work",
  name: "Work",
  emailAddresses: ["ada@work.example.test"],
} as const;

const personalNamed = { identifier: "account-personal", name: "Personal" } as const;
const workNamed = { identifier: "account-work", name: "Work" } as const;

describe("listing mailboxes", () => {
  let mailStore: FakeMailStore;
  let client: Client;

  const listMailboxes = async (): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_mailboxes", arguments: {} });

  beforeEach(async () => {
    mailStore = new FakeMailStore();
    client = await connectedTo(aServer({ mailStore }));
  });

  // long-tail/zaclohrenz 277aac7 and upstream PR #73 listed mailbox names with no account, so
  // nothing said where a mailbox was.
  it("reports each mailbox under the mail account it belongs to, by its path", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, { path: ["Receipts"] });

    const result = await listMailboxes();

    expect(result.structuredContent).toStrictEqual({
      mailboxes: [
        {
          mailAccount: { identifier: "account-personal", name: "Personal" },
          path: ["Receipts"],
        },
      ],
      unreadMailAccounts: [],
    });
  });

  // felkru c769cc0: mailboxes were keyed by name, so every account's inbox became one.
  it("given two mail accounts that both have an inbox, reports each inbox under its own account", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, { path: ["INBOX"], role: "inbox" });
    mailStore.holdsMailboxes(work, { path: ["INBOX"], role: "inbox" });

    const result = await listMailboxes();

    expect(result.structuredContent).toMatchObject({
      mailboxes: [
        { mailAccount: personalNamed, path: ["INBOX"] },
        { mailAccount: workNamed, path: ["INBOX"] },
      ],
    });
  });

  // morquis 8a9b013 joined the names with "/" and admits a name containing one breaks it
  // (findings MAIL-C14), so a path is a list of names.
  it("given a mailbox inside another, reports its path as every name from the outermost in", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, { path: ["Clients", "Invoices 2026/27"] });

    const result = await listMailboxes();

    expect(result.structuredContent).toMatchObject({
      mailboxes: [{ mailAccount: personalNamed, path: ["Clients", "Invoices 2026/27"] }],
    });
  });

  // morquis d76f3ec and upstream PR #73 found the inbox in a list of names (INBOX, Inbox,
  // Posteingang) and fell back to "the first mailbox" (findings MAIL-C3). A name is whatever
  // the provider and the language make it; the role is Mail's own.
  it("given an inbox that a provider calls something else, still reports it as the inbox", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, { path: ["Posteingang"], role: "inbox" });

    const result = await listMailboxes();

    expect(result.structuredContent).toMatchObject({
      mailboxes: [{ path: ["Posteingang"], role: "inbox" }],
    });
  });

  it("given a mailbox Mail knows no role for, reports none rather than reading one from its name", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, { path: ["Inbox"] });

    const result = await listMailboxes();

    expect(result.structuredContent).toMatchObject({
      mailboxes: [expect.not.objectContaining({ role: expect.anything() as unknown })],
    });
  });

  // brightline 304f384 and upstream #19: one slow account took every account's answer with it.
  it("given a mail account that ran out of its time budget, still reports what the others answered and names the account it could not read, with why", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, { path: ["INBOX"], role: "inbox" });
    mailStore.cannotRead(work, mailAccountTimedOut);

    const result = await listMailboxes();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toStrictEqual({
      mailboxes: [{ mailAccount: personalNamed, path: ["INBOX"], role: "inbox" }],
      unreadMailAccounts: [{ mailAccount: workNamed, failure: mailAccountTimedOut }],
    });
  });

  // Measured while building #45: a mailbox of 76,000 emails ran out of its time budget, and Mail
  // answered the very next request in a fifth of a second. One timeout is one slow account.
  it("given a mail account that ran out of its time budget, still asks about the accounts after it", async () => {
    const archive = { identifier: "account-archive", name: "Archive", emailAddresses: [] };
    mailStore.holdsMailAccounts(personal, work, archive);
    mailStore.cannotRead(work, mailAccountTimedOut);
    mailStore.holdsMailboxes(archive, { path: ["INBOX"], role: "inbox" });

    const result = await listMailboxes();

    expect(mailStore.mailAccountsAsked).toStrictEqual([
      "account-personal",
      "account-work",
      "account-archive",
    ]);
    expect(result.structuredContent).toMatchObject({
      mailboxes: [{ mailAccount: { identifier: "account-archive" }, path: ["INBOX"] }],
      unreadMailAccounts: [{ mailAccount: workNamed, failure: { code: "mail_timed_out" } }],
    });
  });

  // #7: after a request Mail could not finish, it answered nothing for another two to four
  // minutes. So after a timeout Mail is asked something small, and only a Mail that leaves that
  // unanswered too is taken to be busy: a slow account next to another slow one is not.
  it("given a mail account that ran out of its time budget and a Mail that then answers nothing, leaves the accounts after it alone and names each as not asked", async () => {
    const archive = { identifier: "account-archive", name: "Archive", emailAddresses: [] };
    mailStore.holdsMailAccounts(personal, work, archive);
    mailStore.holdsMailboxes(personal, { path: ["INBOX"], role: "inbox" });
    mailStore.cannotRead(work, mailAccountTimedOut);
    mailStore.answersNothingAfterATimeout();
    mailStore.holdsMailboxes(archive, { path: ["INBOX"], role: "inbox" });

    const result = await listMailboxes();

    expect(mailStore.mailAccountsAsked).toStrictEqual(["account-personal", "account-work"]);
    expect(result.structuredContent).toMatchObject({
      mailboxes: [{ mailAccount: personalNamed, path: ["INBOX"] }],
      unreadMailAccounts: [
        { mailAccount: workNamed, failure: { code: "mail_timed_out" } },
        {
          mailAccount: { identifier: "account-archive", name: "Archive" },
          failure: {
            code: "mail-account-not-asked",
            sentence:
              "Mail stopped answering before this mail account was asked about, so it was " +
              "left alone: Mail can stay busy for minutes. Ask again later.",
            evidence: "Work: mail_timed_out",
          },
        },
      ],
    });
  });

  it("given a mail account that failed some other way, still asks about the accounts after it", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.cannotRead(personal, {
      code: "mail_unreadable",
      sentence: "Mail could not be read, so nothing was listed or ruled out.",
      evidence: "Mail got an error: AppleEvent handler failed. (-10000)",
    });
    mailStore.holdsMailboxes(work, { path: ["INBOX"], role: "inbox" });

    const result = await listMailboxes();

    expect(result.structuredContent).toMatchObject({
      mailboxes: [{ mailAccount: workNamed, path: ["INBOX"] }],
      unreadMailAccounts: [{ mailAccount: personalNamed, failure: { code: "mail_unreadable" } }],
    });
  });

  it("given no mail account could be read, refuses and names each one rather than reporting no mailboxes", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.cannotRead(personal, mailAccountTimedOut);
    mailStore.cannotRead(work, mailAccountTimedOut);

    const result = await listMailboxes();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toStrictEqual({
      failure: {
        code: "mail-accounts-unread",
        sentence: "None of the 2 mail accounts could be read, so no mailbox was listed.",
        evidence: "Personal: mail_timed_out; Work: mail_timed_out",
      },
    });
  });

  // brightline 84edc6b: Mail answers one request at a time, and asking it about every account
  // at once is what hung it for minutes (#7).
  it("asks about one mail account at a time, never two at once", async () => {
    mailStore.holdsMailAccounts(personal, work);

    await listMailboxes();

    expect(mailStore.mostMailAccountsAskedAtOnce).toBe(1);
  });

  it("given Mail was refused, refuses and names the setting to enable rather than reporting no mailboxes", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.refuses(mailRefused);

    const result = await listMailboxes();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "mail_permission_missing" },
    });
  });
});
