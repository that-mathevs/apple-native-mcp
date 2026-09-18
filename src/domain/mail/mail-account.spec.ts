import { describe, expect, it } from "vitest";

import { type MailAccount, theMailAccountNamed } from "./mail-account.js";

const personal: MailAccount = {
  identifier: "0F1E2D3C-0000-4000-8000-00000000A001",
  name: "Personal",
  emailAddresses: ["ada@example.test", "Ada.Lovelace@Example.test"],
};

const work: MailAccount = {
  identifier: "0F1E2D3C-0000-4000-8000-00000000A002",
  name: "Work",
  emailAddresses: ["ada@work.example.test"],
};

const named = (
  name: string,
  mailAccounts = [personal, work],
): ReturnType<typeof theMailAccountNamed> =>
  theMailAccountNamed(mailAccounts, name, "Nothing was read.");

describe("naming a mail account", () => {
  it("given its identifier, means that mail account", () => {
    expect(named(work.identifier)).toStrictEqual({ ok: true, value: work });
  });

  it("given its exact name, means that mail account", () => {
    expect(named("Work")).toStrictEqual({ ok: true, value: work });
  });

  // ANierbeck 3005df4: a person says "my work address", never a UUID, and names repeat.
  it("given one of its email addresses, means that mail account", () => {
    expect(named("ada@work.example.test")).toStrictEqual({ ok: true, value: work });
  });

  it("compares an email address without regard to case, as mail does", () => {
    expect(named("ADA.lovelace@example.TEST")).toStrictEqual({ ok: true, value: personal });
  });

  it("compares a name exactly: a name is whatever the user typed into Mail", () => {
    expect(named("work")).toMatchObject({ ok: false, failure: { code: "mail-account-unknown" } });
  });

  // sicdigital 791f5f2 keyed containers by their names, so two with one name became one.
  it("given a name two mail accounts share, refuses and names both rather than choosing one", () => {
    const alsoWork = { ...personal, name: "Work" };

    expect(named("Work", [alsoWork, work])).toStrictEqual({
      ok: false,
      failure: {
        code: "mail-account-ambiguous",
        sentence:
          "Nothing was read. More than one mail account has that name or that email address, " +
          "so ask by identifier.",
        evidence: JSON.stringify({ asked: "Work", mailAccounts: [alsoWork, work] }),
      },
    });
  });

  it("given an email address two mail accounts share, refuses and names both", () => {
    const alias = { ...work, emailAddresses: ["ada@example.test"] };

    expect(named("ada@example.test", [personal, alias])).toMatchObject({
      ok: false,
      failure: {
        code: "mail-account-ambiguous",
        evidence: JSON.stringify({ asked: "ada@example.test", mailAccounts: [personal, alias] }),
      },
    });
  });

  // An identifier never repeats, and a name is whatever the user typed, which could be anything.
  it("given a word that is one mail account's identifier and another's name, means the one whose identifier it is", () => {
    const oddlyNamed = { ...personal, name: work.identifier };

    expect(named(work.identifier, [oddlyNamed, work])).toStrictEqual({ ok: true, value: work });
  });

  it("given a name no mail account has, says so and lists the mail accounts there are", () => {
    expect(named("Hotmail")).toStrictEqual({
      ok: false,
      failure: {
        code: "mail-account-unknown",
        sentence:
          "Nothing was read. No mail account has that identifier, that name or that email " +
          "address.",
        evidence: JSON.stringify({ asked: "Hotmail", mailAccounts: [personal, work] }),
      },
    });
  });
});
