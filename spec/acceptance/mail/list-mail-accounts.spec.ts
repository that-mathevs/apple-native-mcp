import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeMailStore, mailRefused } from "../../support/fake-mail-store.js";

const personal = {
  identifier: "account-personal",
  name: "Personal",
  emailAddresses: ["ada@example.test", "ada.lovelace@example.test"],
} as const;

describe("listing mail accounts", () => {
  let mailStore: FakeMailStore;
  let client: Client;

  const listMailAccounts = async (): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_mail_accounts", arguments: {} });

  beforeEach(async () => {
    mailStore = new FakeMailStore();
    client = await connectedTo(aServer({ mailStore }));
  });

  // chrischall 0860cf8: an account known only by its name left an agent unable to say which
  // address an email would be sent from.
  it("returns every mail account with its identifier, its name and its email addresses", async () => {
    mailStore.holdsMailAccounts(personal);

    const result = await listMailAccounts();

    expect(result.structuredContent).toStrictEqual({
      mailAccounts: [
        {
          identifier: "account-personal",
          name: "Personal",
          emailAddresses: ["ada@example.test", "ada.lovelace@example.test"],
        },
      ],
    });
  });

  // Upstream #69 and felkru c769cc0: a refused Mail read as "no accounts", and a Mail with no
  // accounts read as a missing permission. They are two answers.
  it("given Mail was refused, refuses and names the setting to enable rather than reporting no mail accounts", async () => {
    mailStore.refuses(mailRefused);

    const result = await listMailAccounts();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "mail-permission-missing",
        sentence: expect.stringContaining("Privacy & Security > Automation") as string,
      },
    });
  });

  // long-tail/zaclohrenz 277aac7
  it("given Mail has no accounts set up, reports none rather than a permission failure", async () => {
    const result = await listMailAccounts();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toStrictEqual({ mailAccounts: [] });
  });
});
