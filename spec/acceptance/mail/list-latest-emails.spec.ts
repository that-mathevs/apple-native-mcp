import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { anEmail, FakeMailStore, mailAccountTimedOut } from "../../support/fake-mail-store.js";

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

const inbox = { path: ["INBOX"], role: "inbox" } as const;

describe("listing the latest mail", () => {
  let mailStore: FakeMailStore;
  let client: Client;

  const listLatestEmails = async (
    request: Record<string, unknown> = {},
  ): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_latest_emails", arguments: request });

  const emailsIn = (result: Awaited<ReturnType<typeof listLatestEmails>>): unknown[] =>
    (result.structuredContent as { emails: unknown[] }).emails;

  beforeEach(async () => {
    mailStore = new FakeMailStore();
    client = await connectedTo(aServer({ mailStore }));
  });

  // brightline 0833904 and gene-jelly bb07be5 returned the first emails in mailbox order, which a
  // mailbox sorted any other way makes the oldest ones.
  it("reports the most recently received emails first, whatever order the mailbox keeps them in", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Invoice 41", { receivedAt: "2026-09-16T09:00:00Z" }),
      anEmail("Invoice 43", { receivedAt: "2026-09-18T09:00:00Z" }),
      anEmail("Invoice 42", { receivedAt: "2026-09-17T09:00:00Z" }),
    );

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({
      emails: [{ subject: "Invoice 43" }, { subject: "Invoice 42" }, { subject: "Invoice 41" }],
    });
  });

  // brightline 0833904: "latest" was the first account's inbox, so a quiet first account hid
  // everything newer in the others.
  it("given several mail accounts, reports the most recently received across all of them, each under its own mail account and mailbox", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsMailboxes(work, { path: ["Posteingang"], role: "inbox" });
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Dinner", { receivedAt: "2026-09-17T19:00:00Z" }),
    );
    mailStore.holdsEmails(
      work,
      { path: ["Posteingang"] },
      anEmail("Standup notes", { receivedAt: "2026-09-18T08:00:00Z" }),
    );

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({
      emails: [
        {
          subject: "Standup notes",
          mailbox: {
            mailAccount: { identifier: "account-work", name: "Work" },
            path: ["Posteingang"],
          },
        },
        {
          subject: "Dinner",
          mailbox: {
            mailAccount: { identifier: "account-personal", name: "Personal" },
            path: ["INBOX"],
          },
        },
      ],
    });
  });

  // gene-jelly c5a0edd walked every mailbox in the order Mail lists them, and junk filled the
  // limit before the inbox was reached (findings MAIL-C2).
  it("looks in each mail account's inbox and nowhere else: newer junk is not the latest mail", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, { path: ["Junk"], role: "junk" }, inbox);
    mailStore.holdsEmails(
      personal,
      { path: ["Junk"] },
      anEmail("You have won", { receivedAt: "2026-09-18T12:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Dinner", { receivedAt: "2026-09-17T19:00:00Z" }),
    );

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({ emails: [{ subject: "Dinner" }] });
    expect(emailsIn(result)).toHaveLength(1);
  });

  // felkru c769cc0 reported every email as unread.
  // gene-jelly bb07be5 and fpjnijweide 42c9e11 picked an email out again by its subject, and
  // acted on a different one with a similar subject (findings MAIL-C7).
  it("reports each email's real read state, its sender, when it was received and a reference a later read can act on, and no body", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Dinner", {
        receivedAt: "2026-09-17T19:00:00Z",
        sender: "Grace Hopper <grace@example.test>",
        isRead: true,
        messageId: "<dinner@example.test>",
      }),
    );

    const result = await listLatestEmails();

    expect(emailsIn(result)).toStrictEqual([
      {
        mailbox: {
          mailAccount: { identifier: "account-personal", name: "Personal" },
          path: ["INBOX"],
        },
        reference: {
          mailAccount: "account-personal",
          mailboxPath: ["INBOX"],
          messageId: "<dinner@example.test>",
          storeIdentifier: expect.any(Number) as number,
        },
        subject: "Dinner",
        sender: "Grace Hopper <grace@example.test>",
        receivedAt: "2026-09-17T19:00:00.000Z",
        isRead: true,
      },
    ]);
  });

  it("given a limit, reports that many of the newest across every mail account", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Oldest", { receivedAt: "2026-09-15T09:00:00Z" }),
      anEmail("Newest", { receivedAt: "2026-09-18T09:00:00Z" }),
    );
    mailStore.holdsEmails(work, inbox, anEmail("Middle", { receivedAt: "2026-09-17T09:00:00Z" }));

    const result = await listLatestEmails({ limit: 2 });

    expect(result.structuredContent).toMatchObject({
      emails: [{ subject: "Newest" }, { subject: "Middle" }],
    });
    expect(emailsIn(result)).toHaveLength(2);
  });

  const mailUnreadable = {
    code: "mail_unreadable",
    sentence: "Mail could not be read, so nothing was listed or ruled out.",
    evidence: "Mail got an error: AppleEvent handler failed. (-10000)",
  };

  // brightline 304f384 and upstream #19: one account that failed took every account's answer.
  it("given a mail account that cannot be read, still reports the others' latest mail and names the mail account, with why", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.cannotRead(personal, mailUnreadable);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Standup notes", { receivedAt: "2026-09-18T08:00:00Z" }),
    );

    const result = await listLatestEmails();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      emails: [{ subject: "Standup notes" }],
      unreadMailAccounts: [
        {
          mailAccount: { identifier: "account-personal", name: "Personal" },
          failure: mailUnreadable,
        },
      ],
    });
  });

  // Measured on a real Mac: an inbox of 76,000 emails ran out of its time budget, and the two
  // accounts after it answered in a fifth of a second each.
  it("given a mail account that ran out of its time budget, still reports the latest mail of the mail accounts after it", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.cannotRead(personal, mailAccountTimedOut);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Standup notes", { receivedAt: "2026-09-18T08:00:00Z" }),
    );

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({
      emails: [{ subject: "Standup notes" }],
      unreadMailAccounts: [
        { mailAccount: { identifier: "account-personal" }, failure: { code: "mail_timed_out" } },
      ],
    });
  });

  // morquis d76f3ec fell back to "the first mailbox" when no name matched, and reported some
  // other mailbox's mail as the inbox's (findings MAIL-C3).
  it("given a mail account Mail gives no inbox, names it rather than passing over it", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, { path: ["Notes"] });
    mailStore.holdsMailboxes(work, inbox);

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({
      emails: [],
      unreadMailAccounts: [
        {
          mailAccount: { identifier: "account-personal", name: "Personal" },
          failure: {
            code: "mail-account-has-no-inbox",
            sentence:
              "Mail gives none of this mail account's mailboxes the inbox role, so its latest " +
              "mail was not read. Name a mailbox to read it from.",
          },
        },
      ],
    });
  });

  // danielk-am ad3e9e9: a store that never answered read as a Mac with nothing in it.
  it("given no mail account could be read, refuses rather than reporting no mail", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.cannotRead(personal, mailUnreadable);

    const result = await listLatestEmails();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "mail-accounts-unread",
        sentence: "None of the 1 mail accounts could be read, so no email was listed.",
      },
    });
  });

  // A Message-ID costs ten times what any other column does to read: on a real Mac, 2.8 seconds
  // for an inbox of a thousand. Latest mail across seven accounts would wait on all of them.
  it("asks the mail store for a Message-ID for each email it reports and for no other", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Older", { receivedAt: "2026-09-15T09:00:00Z" }),
      anEmail("Newer", { receivedAt: "2026-09-18T09:00:00Z" }),
    );

    await listLatestEmails({ limit: 1 });

    expect(mailStore.messageIdsRead).toBe(1);
  });

  // felkru 22aa354: an email deleted since it was listed was still reported.
  it("given an email that went while the answer was being put together, leaves it out", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Gone", { receivedAt: "2026-09-18T09:00:00Z", goesBeforeItsMessageIdIsRead: true }),
      anEmail("Still here", { receivedAt: "2026-09-17T09:00:00Z" }),
    );

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({ emails: [{ subject: "Still here" }] });
    expect(emailsIn(result)).toHaveLength(1);
  });

  // Upstream #30 and #58: there was no way to ask for one account's, or one mailbox's, newest.
  it("given a mail account, reports the latest mail of that mail account's inbox alone", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Dinner", { receivedAt: "2026-09-18T19:00:00Z" }),
    );
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Standup notes", { receivedAt: "2026-09-18T08:00:00Z" }),
    );

    const result = await listLatestEmails({ mailAccount: "account-work" });

    expect(result.structuredContent).toMatchObject({ emails: [{ subject: "Standup notes" }] });
    expect(emailsIn(result)).toHaveLength(1);
    expect(mailStore.mailAccountsAsked).toStrictEqual(["account-work"]);
  });

  it("given a mailbox, reports that mailbox's newest emails in place of the inbox's", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox, { path: ["Clients", "Invoices"] });
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Dinner", { receivedAt: "2026-09-18T19:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Clients", "Invoices"] },
      anEmail("Invoice 43", { receivedAt: "2026-09-10T09:00:00Z" }),
    );

    const result = await listLatestEmails({
      mailAccount: "account-personal",
      mailbox: ["Clients", "Invoices"],
    });

    expect(result.structuredContent).toMatchObject({ emails: [{ subject: "Invoice 43" }] });
    expect(emailsIn(result)).toHaveLength(1);
  });

  // A path alone names a mailbox in every mail account that has one: INBOX, for a start.
  it("given a mailbox and no mail account, refuses: a path names a mailbox only inside its mail account", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);

    const result = await listLatestEmails({ mailbox: ["INBOX"] });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "mailbox-needs-its-mail-account" },
    });
  });

  it("given an identifier no mail account has, refuses rather than reading every mail account", async () => {
    mailStore.holdsMailAccounts(personal);

    const result = await listLatestEmails({ mailAccount: "account-gone" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "mail-account-unknown", evidence: "account-gone" },
    });
  });

  it("given a path no mailbox of that mail account has, refuses rather than reading its inbox", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);

    const result = await listLatestEmails({
      mailAccount: "account-personal",
      mailbox: ["Receipts"],
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "mailbox-unknown", evidence: "Receipts" },
    });
  });

  it("given the Message-IDs of one mail account's latest mail cannot be read, still reports the others' and names that mail account", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Dinner", { receivedAt: "2026-09-18T19:00:00Z" }),
    );
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Standup notes", { receivedAt: "2026-09-18T08:00:00Z" }),
    );
    mailStore.cannotReadMessageIds(personal, inbox, mailUnreadable);

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({
      emails: [{ subject: "Standup notes" }],
      unreadMailAccounts: [
        {
          mailAccount: { identifier: "account-personal" },
          failure: { code: "mailbox-matches-unreferenced" },
        },
      ],
    });
    expect(emailsIn(result)).toHaveLength(1);
  });

  // findings MAIL-49: an email with no date was given one that was made up.
  it("given emails with no received date, which cannot be placed among the latest, says how many there were", async () => {
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);
    mailStore.holdsUndatedEmails(personal, inbox, 2);

    const result = await listLatestEmails();

    expect(result.structuredContent).toMatchObject({ emails: [], undated: 2 });
  });
});
