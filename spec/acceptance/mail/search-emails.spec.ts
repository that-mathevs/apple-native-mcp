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

// The server's clock in these scenarios: 18 September 2026, midday in New York.
describe("searching mail", () => {
  let mailStore: FakeMailStore;
  let client: Client;

  const searchEmails = async (request: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "search_emails", arguments: request });

  const subjectsIn = (result: Awaited<ReturnType<typeof searchEmails>>): string[] =>
    (result.structuredContent as { emails: { subject: string }[] }).emails.map(
      ({ subject }) => subject,
    );

  beforeEach(async () => {
    mailStore = new FakeMailStore();
    client = await connectedTo(aServer({ mailStore }));
    mailStore.holdsMailAccounts(personal);
    mailStore.holdsMailboxes(personal, inbox);
  });

  // Upstream #69: a search found nothing the user could see in Mail, because it matched one
  // field of one mailbox.
  it("finds emails whose subject or sender the search query matches", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
      anEmail("Quote", {
        receivedAt: "2026-09-16T09:00:00Z",
        sender: "Hartley Boiler Repairs <office@hartley.example.test>",
      }),
      anEmail("Dinner on Friday", { receivedAt: "2026-09-15T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler service", "Quote"]);
  });

  // #24: one grammar for Mail and Messages, so an agent learns one syntax. Upstream #30: an
  // asterisk in a query was read as a wildcard.
  it("reads the search query by the grammar Messages uses: a phrase as written, an exclusion left out, and the email holding more of the words first", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler quote", { receivedAt: "2026-09-17T09:00:00Z" }),
      anEmail("Boiler annual service quote", { receivedAt: "2026-09-10T09:00:00Z" }),
      anEmail("Boiler newsletter: annual service offers", { receivedAt: "2026-09-16T09:00:00Z" }),
      anEmail("Service annual report", { receivedAt: "2026-09-15T09:00:00Z" }),
    );

    const result = await searchEmails({ query: 'boiler quote "annual service" -newsletter' });

    expect(subjectsIn(result)).toStrictEqual(["Boiler annual service quote", "Boiler quote"]);
  });

  // chrischall 25d47cc quietly searched the newest 30 emails, so "no such email" was said of a
  // mailbox nobody had read. A default range is fine as long as the answer says what it was.
  it("given no range, searches the last 30 days, today included, and says which range that was", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-08-20T12:00:00Z" }),
      anEmail("Boiler warranty", { receivedAt: "2026-08-19T12:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler service"]);
    expect(result.structuredContent).toMatchObject({
      range: { from: "2026-08-20T04:00:00.000Z", to: "2026-09-19T04:00:00.000Z" },
    });
  });

  it("given a range, finds only emails received inside it, a day alone meaning the whole of that day here", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler before", { receivedAt: "2026-07-01T03:59:00Z" }),
      anEmail("Boiler first thing", { receivedAt: "2026-07-01T04:00:00Z" }),
      anEmail("Boiler last thing", { receivedAt: "2026-07-03T03:59:00Z" }),
      anEmail("Boiler after", { receivedAt: "2026-07-03T04:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler", from: "2026-07-01", to: "2026-07-02" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler last thing", "Boiler first thing"]);
  });

  // long-tail/zaclohrenz 277aac7 searched the inbox alone, and gene-jelly c5a0edd let junk fill
  // the answer (findings MAIL-C2).
  it("searches every mailbox of a mail account but its junk and its trash", async () => {
    mailStore.holdsMailboxes(
      personal,
      inbox,
      { path: ["Receipts"] },
      { path: ["Junk"], role: "junk" },
      { path: ["Deleted"], role: "trash" },
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Receipts"] },
      anEmail("Boiler receipt", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Junk"] },
      anEmail("Boiler prize", { receivedAt: "2026-09-17T10:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Deleted"] },
      anEmail("Boiler spam", { receivedAt: "2026-09-17T11:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler receipt"]);
    expect(result.structuredContent).toMatchObject({ coverage: { mailboxesSearched: 2 } });
  });

  // Upstream PR #37 took the first matches it met, so an old mailbox could crowd out new mail.
  it("given more matches than the limit, reports the best across every mailbox searched and says how many matched in all", async () => {
    mailStore.holdsMailboxes(personal, inbox, { path: ["Receipts"] });
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler old", { receivedAt: "2026-09-01T09:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Receipts"] },
      anEmail("Boiler new", { receivedAt: "2026-09-17T09:00:00Z" }),
      anEmail("Boiler newer", { receivedAt: "2026-09-18T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler", limit: 2 });

    expect(subjectsIn(result)).toStrictEqual(["Boiler newer", "Boiler new"]);
    expect(result.structuredContent).toMatchObject({ coverage: { scanned: 3, matched: 3 } });
  });

  it("given a query with nothing to find, matches nothing and reads no mailbox", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler", { receivedAt: "2026-09-17T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "-boiler" });

    expect(subjectsIn(result)).toStrictEqual([]);
    expect(mailStore.mailAccountsAsked).toStrictEqual([]);
    expect(result.structuredContent).toMatchObject({
      coverage: { mailboxesSearched: 0, scanned: 0, matched: 0 },
    });
  });

  // chrischall 25d47cc: a date it could not read searched nothing, and said "no mail".
  it("given a date that cannot be read as one, refuses rather than searching some other range", async () => {
    const result = await searchEmails({ query: "boiler", from: "last Tuesday" });

    expect(result.isError).toBe(true);
  });

  it("given a range that ends before it starts, refuses and searches nothing", async () => {
    const result = await searchEmails({ query: "boiler", from: "2026-09-10", to: "2026-09-01" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ failure: { code: "range-not-forwards" } });
  });

  it("given a mail account, searches that mail account alone", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler at home", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Boiler room audit", { receivedAt: "2026-09-18T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler", mailAccount: "account-work" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler room audit"]);
    expect(mailStore.mailAccountsAsked).toStrictEqual(["account-work"]);
  });

  // ANierbeck 3005df4: a person says "my work address", and never the identifier Mail made up.
  it("given one of a mail account's email addresses in place of its identifier, searches that mail account alone", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Boiler room audit", { receivedAt: "2026-09-18T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler", mailAccount: "ada@work.example.test" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler room audit"]);
    expect(mailStore.mailAccountsAsked).toStrictEqual(["account-work"]);
  });

  // sicdigital 791f5f2 keyed containers by their names, so two with one name became one, and
  // whichever came first was searched.
  it("given a name two mail accounts share, refuses and names both rather than searching either", async () => {
    const alsoWork = { identifier: "account-work-old", name: "Work", emailAddresses: [] };
    mailStore.holdsMailAccounts(personal, work, alsoWork);

    const result = await searchEmails({ query: "boiler", mailAccount: "Work" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "mail-account-ambiguous",
        evidence: JSON.stringify({ asked: "Work", mailAccounts: [work, alsoWork] }),
      },
    });
    expect(mailStore.mailAccountsAsked).toStrictEqual([]);
  });

  it("given a mailbox, searches that mailbox alone, junk included when junk is the one named", async () => {
    mailStore.holdsMailboxes(personal, inbox, { path: ["Junk"], role: "junk" });
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Junk"] },
      anEmail("Boiler prize", { receivedAt: "2026-09-17T10:00:00Z" }),
    );

    const result = await searchEmails({
      query: "boiler",
      mailAccount: "account-personal",
      mailbox: ["Junk"],
    });

    expect(subjectsIn(result)).toStrictEqual(["Boiler prize"]);
  });

  // upstream #69: asked about an account it could not find, a fork searched them all.
  it("given a name no mail account has, refuses, listing the mail accounts there are, rather than searching every mail account", async () => {
    const result = await searchEmails({ query: "boiler", mailAccount: "Hotmail" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "mail-account-unknown",
        evidence: JSON.stringify({ asked: "Hotmail", mailAccounts: [personal] }),
      },
    });
    expect(mailStore.mailAccountsAsked).toStrictEqual([]);
  });

  it("given a path no mailbox of that mail account has, refuses rather than searching the others", async () => {
    const result = await searchEmails({
      query: "boiler",
      mailAccount: "account-personal",
      mailbox: ["Receipts", "2019"],
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "mailbox-unknown", evidence: "Receipts/2019" },
    });
  });

  // A path alone names a mailbox in every account that has one: INBOX, for a start.
  it("given a mailbox and no mail account, refuses: a path names a mailbox only inside its mail account", async () => {
    const result = await searchEmails({ query: "boiler", mailbox: ["INBOX"] });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "mailbox-needs-its-mail-account" },
    });
  });

  const mailUnreadable = {
    code: "mail-unreadable",
    sentence: "Mail could not be read, so nothing was listed or ruled out.",
    evidence: "Mail got an error: AppleEvent handler failed. (-10000)",
  };
  const personalNamed = { identifier: "account-personal", name: "Personal" };

  // brightline 304f384 and upstream #19: one failure took the whole answer with it.
  it("given a mailbox that cannot be read, still searches the others and names the one it could not search, with why", async () => {
    mailStore.holdsMailboxes(personal, inbox, { path: ["Receipts"] });
    mailStore.cannotSearch(personal, inbox, mailUnreadable);
    mailStore.holdsEmails(
      personal,
      { path: ["Receipts"] },
      anEmail("Boiler receipt", { receivedAt: "2026-09-17T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler receipt"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { mailboxesSearched: 1 },
      unsearchedMailboxes: [
        { mailbox: { mailAccount: personalNamed, path: ["INBOX"] }, failure: mailUnreadable },
      ],
    });
  });

  // Measured on a real Mac: one huge mailbox ran out of its time budget, and Mail answered the
  // next request at once. One timeout is one slow mailbox.
  it("given a mailbox that ran out of its time budget, still searches the mailboxes after it", async () => {
    mailStore.holdsMailboxes(personal, inbox, { path: ["Huge"] }, { path: ["Receipts"] });
    mailStore.cannotSearch(personal, { path: ["Huge"] }, mailAccountTimedOut);
    mailStore.holdsEmails(
      personal,
      { path: ["Receipts"] },
      anEmail("Boiler receipt", { receivedAt: "2026-09-17T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler receipt"]);
    expect(result.structuredContent).toMatchObject({
      unsearchedMailboxes: [{ mailbox: { path: ["Huge"] }, failure: { code: "mail-timed-out" } }],
    });
  });

  // Seen on a real Mac: two large mailboxes next to each other both ran out of time, the second
  // only because Mail was still finishing the first, and everything after them was healthy.
  it("given two mailboxes running that ran out of their time budgets while Mail still answers a small question between them, searches on", async () => {
    mailStore.holdsMailboxes(personal, { path: ["Huge"] }, { path: ["Huger"] }, inbox);
    mailStore.cannotSearch(personal, { path: ["Huge"] }, mailAccountTimedOut);
    mailStore.cannotSearch(personal, { path: ["Huger"] }, mailAccountTimedOut);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler service"]);
  });

  // #7: after a request Mail could not finish, it answered nothing for minutes more. A Mail that
  // leaves even a small question unanswered is that Mail, so the search reports what it has.
  it("given a mailbox that ran out of its time budget and a Mail that then answers nothing, leaves every mailbox and mail account after it alone, names each as not asked, and reports what it had found", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, inbox, { path: ["Huge"] }, { path: ["Receipts"] });
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.cannotSearch(personal, { path: ["Huge"] }, mailAccountTimedOut);
    mailStore.answersNothingAfterATimeout();

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler service"]);
    expect(mailStore.mailboxesSearched).toStrictEqual(["Personal/INBOX", "Personal/Huge"]);
    expect(result.structuredContent).toMatchObject({
      unsearchedMailboxes: [
        { mailbox: { path: ["Huge"] }, failure: { code: "mail-timed-out" } },
        {
          mailbox: { path: ["Receipts"] },
          failure: { code: "mailbox-not-asked", evidence: "Personal/Huge: mail-timed-out" },
        },
      ],
      unreadMailAccounts: [
        {
          mailAccount: { identifier: "account-work", name: "Work" },
          failure: { code: "mail-account-not-asked" },
        },
      ],
    });
  });

  // brightline 304f384 and upstream #19: one account that failed took every account's answer.
  it("given a mail account whose mailboxes cannot be listed, still searches the other mail accounts and names it", async () => {
    mailStore.holdsMailAccounts(personal, work);
    mailStore.cannotRead(personal, mailUnreadable);
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      work,
      inbox,
      anEmail("Boiler room audit", { receivedAt: "2026-09-18T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler room audit"]);
    expect(result.structuredContent).toMatchObject({
      unreadMailAccounts: [{ mailAccount: personalNamed, failure: mailUnreadable }],
    });
  });

  // chrischall 25d47cc: "no such email", said of mail nobody had read.
  it("given nothing could be searched at all, refuses rather than reporting no match", async () => {
    mailStore.cannotSearch(personal, inbox, mailUnreadable);

    const result = await searchEmails({ query: "boiler" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "mail-search-reached-nothing",
        sentence: "No mailbox could be searched, so nothing was found or ruled out.",
        evidence: "Personal/INBOX: mail-unreadable",
      },
    });
  });

  // chrischall 25d47cc bounded a search silently, so "no such email" was said of mail it never
  // reached. A ceiling is fine as long as the answer says where it stopped.
  it("given a mailbox holding more emails in the range than a search looks at, says the mailbox was truncated and how far back it reached", async () => {
    const hourly = Array.from({ length: 2001 }, (_, hour) =>
      anEmail(`Boiler reading ${String(hour)}`, {
        receivedAt: new Date(Date.UTC(2026, 5, 1, 4) + hour * 3_600_000).toISOString(),
      }),
    );
    mailStore.holdsEmails(personal, inbox, ...hourly);

    const result = await searchEmails({ query: "boiler", from: "2026-06-01", limit: 1 });

    expect(result.structuredContent).toMatchObject({
      coverage: {
        scanned: 2000,
        truncatedMailboxes: [
          {
            mailbox: { mailAccount: personalNamed, path: ["INBOX"] },
            reachedBack: "2026-06-01T05:00:00.000Z",
          },
        ],
      },
    });
  });

  // A client waits sixty seconds for a tool at the least (#25), and an account can hold dozens
  // of mailboxes that each answer slowly without any one of them running out of time.
  it("given the search reaches its own time budget, reads no further mailbox, reports what it found and names each mailbox it never reached, with how far it got", async () => {
    let clock = new Date("2026-09-18T16:00:00Z");
    client = await connectedTo(aServer({ mailStore, now: () => clock }));
    mailStore.afterSearchingAMailbox = () => {
      clock = new Date(clock.getTime() + 25_000);
    };
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(personal, inbox, { path: ["Receipts"] }, { path: ["Travel"] });
    mailStore.holdsMailboxes(work, inbox);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Travel"] },
      anEmail("Boiler room tour", { receivedAt: "2026-09-16T09:00:00Z" }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler service"]);
    expect(mailStore.mailboxesSearched).toStrictEqual(["Personal/INBOX", "Personal/Receipts"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { mailboxesSearched: 2 },
      unsearchedMailboxes: [
        {
          mailbox: { path: ["Travel"] },
          failure: {
            code: "mail-search-out-of-time",
            sentence:
              "The search reached its time budget of 40 seconds before this mailbox. Search one " +
              "mail account or one mailbox to reach it.",
            evidence: "2 mailboxes searched in 50 seconds",
          },
        },
      ],
      unreadMailAccounts: [
        {
          mailAccount: { identifier: "account-work", name: "Work" },
          failure: { code: "mail-search-out-of-time" },
        },
      ],
    });
  });

  // #7 and #45 measured a body at between a fifth of a second and a second each to read, which
  // is upstream #19's hang. So a body is read only when the caller asks.
  it("given text that appears only in an email's body, does not find it unless bodies were asked for, and says which parts it searched", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Your appointment", {
        receivedAt: "2026-09-17T09:00:00Z",
        body: "The engineer will service the boiler on Tuesday.",
      }),
    );

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual([]);
    expect(mailStore.bodiesRead).toBe(0);
    expect(result.structuredContent).toMatchObject({
      coverage: { searched: ["subject", "sender"] },
    });
  });

  it("given bodies were asked for, finds an email by its body, says bodies were searched, and still reports no body", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Your appointment", {
        receivedAt: "2026-09-17T09:00:00Z",
        body: "The engineer will service the boiler on Tuesday.",
      }),
    );

    const result = await searchEmails({ query: "boiler", searchBodies: true });

    expect(subjectsIn(result)).toStrictEqual(["Your appointment"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { searched: ["subject", "sender", "body"], bodiesRead: 1, bodiesNotRead: 0 },
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain("engineer");
  });

  // An email whose body was never read has not been searched: it is counted, not ruled out.
  it("given more bodies in the range than could be read in time, says how many it read and how many it did not, and still matches the unread ones by subject and sender", async () => {
    mailStore.readsThisManyBodiesInTime(1);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Your appointment", {
        receivedAt: "2026-09-18T09:00:00Z",
        body: "About the boiler.",
      }),
      anEmail("Boiler quote", { receivedAt: "2026-09-17T09:00:00Z", body: "See attached." }),
      anEmail("Dinner", { receivedAt: "2026-09-16T09:00:00Z", body: "Near the old boiler house." }),
    );

    const result = await searchEmails({ query: "boiler", searchBodies: true });

    expect(subjectsIn(result)).toStrictEqual(["Your appointment", "Boiler quote"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { bodiesRead: 1, bodiesNotRead: 2 },
    });
  });

  // The matches are found by then, and an answer that threw them away would say less than the
  // search knows (#24: a search reports what it has).
  it("given the Message-IDs of one mailbox's matches cannot be read, still reports the other mailboxes' matches, the range and the coverage, and names that mailbox", async () => {
    mailStore.holdsMailboxes(personal, inbox, { path: ["Receipts"] });
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.holdsEmails(
      personal,
      { path: ["Receipts"] },
      anEmail("Boiler receipt", { receivedAt: "2026-09-16T09:00:00Z" }),
    );
    mailStore.cannotReadMessageIds(personal, { path: ["Receipts"] }, mailUnreadable);

    const result = await searchEmails({ query: "boiler" });

    expect(subjectsIn(result)).toStrictEqual(["Boiler service"]);
    expect(result.structuredContent).toMatchObject({
      range: { from: "2026-08-20T04:00:00.000Z" },
      coverage: { matched: 2 },
      unsearchedMailboxes: [
        {
          mailbox: { path: ["Receipts"] },
          failure: {
            code: "mailbox-matches-unreferenced",
            sentence:
              "This mailbox's matches could not be given a reference a later read can act on, " +
              "so they were left out. Search again.",
            evidence: "Personal/Receipts: mail-unreadable",
          },
        },
      ],
    });
  });

  // findings MAIL-49: an email with no date was given one that was made up.
  it("given emails with no received date, which no range can hold, says how many there were rather than dropping them unmentioned", async () => {
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler service", { receivedAt: "2026-09-17T09:00:00Z" }),
    );
    mailStore.holdsUndatedEmails(personal, inbox, 3);

    const result = await searchEmails({ query: "boiler" });

    expect(result.structuredContent).toMatchObject({ coverage: { scanned: 1, undated: 3 } });
  });

  // #24: a body search always states its coverage and stops at its time budget with a named
  // failure rather than hanging.
  it("given bodies were asked for and a mailbox's could not all be read in time, names that mailbox with how many bodies it read", async () => {
    mailStore.readsThisManyBodiesInTime(1);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Your appointment", {
        receivedAt: "2026-09-18T09:00:00Z",
        body: "About the boiler.",
      }),
      anEmail("Dinner", { receivedAt: "2026-09-16T09:00:00Z", body: "Near the old boiler house." }),
    );

    const result = await searchEmails({ query: "boiler", searchBodies: true });

    expect(result.structuredContent).toMatchObject({
      partlySearchedMailboxes: [
        {
          mailbox: { path: ["INBOX"] },
          failure: {
            code: "mailbox-bodies-out-of-time",
            sentence:
              "Not every body in this mailbox could be read within the time budget. The emails " +
              "whose bodies were not read were matched by subject and sender alone: none of " +
              "them has been ruled out. Search a shorter range to read them all.",
            evidence: "1 of 2 bodies read",
          },
        },
      ],
    });
  });

  it("given bodies were asked for and a mailbox's could not be read at all, names that mailbox with why, and still matches its emails by subject and sender", async () => {
    mailStore.cannotReadBodies(personal, inbox, mailUnreadable);
    mailStore.holdsEmails(
      personal,
      inbox,
      anEmail("Boiler quote", { receivedAt: "2026-09-17T09:00:00Z", body: "See attached." }),
    );

    const result = await searchEmails({ query: "boiler", searchBodies: true });

    expect(subjectsIn(result)).toStrictEqual(["Boiler quote"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { bodiesRead: 0, bodiesNotRead: 1 },
      partlySearchedMailboxes: [
        {
          mailbox: { path: ["INBOX"] },
          failure: { code: "mailbox-bodies-unread", evidence: "Personal/INBOX: mail-unreadable" },
        },
      ],
    });
  });
});
