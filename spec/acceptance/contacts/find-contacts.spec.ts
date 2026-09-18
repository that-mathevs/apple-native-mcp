import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { aContact, contactsRefused, FakeContactStore } from "../../support/fake-contact-store.js";

// What an agent learns when it asks who somebody is. Every send later depends on this answer, and
// upstream's version of it sent a message to the wrong person: it matched a number by
// `contains` and a name by any letters inside it (upstream #35).

const sam = aContact("contact-sam", "Sam", "Okafor", {
  organisation: "Hartley & Finch",
  jobTitle: "Surveyor",
  phoneNumbers: [
    { label: "_$!<Mobile>!$_", written: "+44 7700 900123" },
    { label: "_$!<WorkFAX>!$_", written: "020 7946 0958" },
  ],
  emailAddresses: [{ label: "_$!<Work>!$_", address: "sam.okafor@hartleyfinch.example" }],
  postalAddresses: [
    {
      label: "_$!<Home>!$_",
      street: "4 Mill Lane",
      city: "Leeds",
      region: "West Yorkshire",
      postalCode: "LS1 4AB",
      country: "United Kingdom",
    },
  ],
  urls: [{ label: "_$!<HomePage>!$_", url: "https://okafor.example" }],
});

const samantha = aContact("contact-samantha", "Samantha", "Reyes", {
  phoneNumbers: [{ label: "Mum's", written: "(555) 123-4567" }],
});

const otherSam = aContact("contact-sam-2", "Sam", "Okafor");
const okaforLtd = aContact("contact-okafor-ltd", "", "", { organisation: "Okafor Ltd" });

describe("finding contacts", () => {
  let contactStore: FakeContactStore;
  let client: Client;

  const findContacts = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "find_contacts", arguments: args });

  const identifiersFound = async (query: string): Promise<unknown[]> => {
    const result = await findContacts({ query });
    const { contacts } = result.structuredContent as { contacts: { identifier: string }[] };
    return contacts.map(({ identifier }) => identifier);
  };

  beforeEach(async () => {
    contactStore = new FakeContactStore();
    contactStore.holds(samantha, okaforLtd, otherSam, sam);
    client = await connectedTo(aServer({ contactStore }));
  });

  // upstream #75, #47: upstream returned one phone number and nothing else.
  it("given a name, reports the contact with every kind of detail it has, each with its label as a person would say it", async () => {
    const result = await findContacts({ query: "hartley" });

    expect(result.structuredContent).toStrictEqual({
      contacts: [
        {
          identifier: "contact-sam",
          name: "Sam Okafor",
          match: "whole word",
          namePrefix: "",
          givenName: "Sam",
          middleName: "",
          familyName: "Okafor",
          nameSuffix: "",
          nickname: "",
          organisation: "Hartley & Finch",
          jobTitle: "Surveyor",
          phoneNumbers: [
            { label: "mobile", written: "+44 7700 900123", e164: "+447700900123" },
            { label: "work fax", written: "020 7946 0958" },
          ],
          emailAddresses: [{ label: "work", address: "sam.okafor@hartleyfinch.example" }],
          postalAddresses: [
            {
              label: "home",
              street: "4 Mill Lane",
              city: "Leeds",
              region: "West Yorkshire",
              postalCode: "LS1 4AB",
              country: "United Kingdom",
            },
          ],
          urls: [{ label: "home page", url: "https://okafor.example" }],
        },
      ],
      coverage: { truncated: false },
    });
  });

  it("given a middle name or a suffix, finds the contact by it, and the whole name written out is an exact match", async () => {
    contactStore.holds(
      sam,
      aContact("contact-jr", "Sam", "Okafor", { middleName: "James", nameSuffix: "Jr" }),
    );

    expect(await identifiersFound("james")).toStrictEqual(["contact-jr"]);
    expect(await identifiersFound("Sam James Okafor Jr")).toStrictEqual(["contact-jr"]);
  });

  it("given a name written family name first with no space, as Chinese, Japanese and Korean names are, finds the contact", async () => {
    contactStore.holds(aContact("contact-tanaka", "太郎", "田中"));

    expect(await identifiersFound("田中太郎")).toStrictEqual(["contact-tanaka"]);
    expect(await identifiersFound("田中")).toStrictEqual(["contact-tanaka"]);
  });

  it("given digits that are a company's name, finds the company as well as anyone with that number", async () => {
    contactStore.holds(aContact("contact-365", "", "", { organisation: "365" }), samantha);

    expect(await identifiersFound("365")).toStrictEqual(["contact-365"]);
  });

  // upstream #35, KassebaumEngineering 1d47e74: the first match was taken as the answer, and
  // the first match was the wrong Sam.
  it("given a name that matches several contacts, reports every one of them, exact matches first, then whole words, then the starts of words", async () => {
    expect(await identifiersFound("sam okafor")).toStrictEqual(["contact-sam", "contact-sam-2"]);
    expect(await identifiersFound("sam")).toStrictEqual([
      "contact-sam",
      "contact-sam-2",
      "contact-samantha",
    ]);
  });

  // KassebaumEngineering 1d47e74 merged them: one Sam's number beside the other's address.
  it("given two contacts with the same name, reports both separately rather than merging them or choosing one", async () => {
    const result = await findContacts({ query: "Sam Okafor" });

    expect(result.structuredContent).toMatchObject({
      contacts: [
        { identifier: "contact-sam", phoneNumbers: [{}, {}] },
        { identifier: "contact-sam-2", phoneNumbers: [] },
      ],
    });
  });

  // long-tail/tomsr73 35e211d: "am" found Sam, Samantha, Pamela and every Amy.
  it("given letters that appear only inside a word of a name, finds nobody: a name matches at word boundaries", async () => {
    expect(await identifiersFound("kafor")).toStrictEqual([]);
    expect(await identifiersFound("antha")).toStrictEqual([]);
  });

  // ANierbeck 813c232: the same number with and without its brackets was two numbers.
  it("given a phone number written differently from the way the contact holds it, finds the contact who owns it", async () => {
    expect(await identifiersFound("+447700900123")).toStrictEqual(["contact-sam"]);
    expect(await identifiersFound("555.123.4567")).toStrictEqual(["contact-samantha"]);
  });

  // upstream #35: `contains` on a few digits sent a message to the wrong person.
  it("given digits that are only part of a contact's number, finds nobody: one number containing another is not that number", async () => {
    expect(await identifiersFound("7700 900")).toStrictEqual([]);
    expect(await identifiersFound("123-4567")).toStrictEqual([]);
  });

  // #17: a bare national number is never given a country, whatever region the Mac is set to.
  it("given a number that states its country, reports it normalised to E.164, and leaves a bare national number as it is written", async () => {
    const stated = await findContacts({ query: "hartley" });
    expect(stated.structuredContent).toMatchObject({
      contacts: [{ phoneNumbers: [{ e164: "+447700900123" }, { written: "020 7946 0958" }] }],
    });

    const result = await findContacts({ query: "samantha" });

    expect(result.structuredContent).toMatchObject({
      contacts: [{ phoneNumbers: [{ label: "Mum's", written: "(555) 123-4567" }] }],
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain("e164");
  });

  // upstream #75; chrischall 0860cf8
  it("given part of an email address, finds the contact it belongs to", async () => {
    expect(await identifiersFound("okafor@hartley")).toStrictEqual(["contact-sam"]);
  });

  // ANierbeck cd72bdf, morquis d76f3ec: upstream spliced the name into AppleScript.
  it("given a name full of quotes, backslashes and script text, looks for exactly that text and finds nobody", async () => {
    const result = await findContacts({ query: 'Sam" & do shell script "id" & "\\\\' });

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({ contacts: [] });
  });

  // morquis 5c01104: macOS keeps the note for apps Apple has entitled.
  it("never reports a contact note, whatever the contact holds", async () => {
    contactStore.holds({ ...sam, note: "door code 4471" } as typeof sam);

    const result = await findContacts({ query: "sam" });

    expect(JSON.stringify(result)).not.toContain("4471");
    expect(JSON.stringify(result)).not.toContain("note");
  });

  // upstream PR #49, faces-sh 0216d96: a cached answer kept an old number alive.
  it("given a contact edited a moment ago, reports the edited details: nothing is kept from the last answer", async () => {
    await findContacts({ query: "samantha" });
    contactStore.holds({ ...samantha, phoneNumbers: [{ label: "home", written: "555 000 1111" }] });

    const result = await findContacts({ query: "samantha" });

    expect(result.structuredContent).toMatchObject({
      contacts: [{ phoneNumbers: [{ written: "555 000 1111" }] }],
    });
    expect(contactStore.reads).toBe(2);
  });

  // sicdigital d261523: an answer cut short with no way to ask for the rest hid the right Sam.
  it("given more contacts than the limit, reports the best of them, says the answer is truncated and where the next page starts", async () => {
    const first = await findContacts({ query: "sam", limit: 2 });
    const next = await findContacts({ query: "sam", limit: 2, offset: 2 });

    expect(first.structuredContent).toMatchObject({
      contacts: [{ identifier: "contact-sam" }, { identifier: "contact-sam-2" }],
      coverage: { truncated: true, nextOffset: 2 },
    });
    expect(next.structuredContent).toMatchObject({
      contacts: [{ identifier: "contact-samantha" }],
      coverage: { truncated: false },
    });
  });

  // security-coverage, threat 5: a read can't be made to pull everything at once. "@" is part
  // of every email address there is.
  it("given too little to go on, such as a lone @ or a single letter before one, refuses rather than reporting everybody", async () => {
    const lone = await findContacts({ query: "@" });
    const short = await findContacts({ query: "a@" });

    expect(lone.structuredContent).toMatchObject({ failure: { code: "query-too-short" } });
    expect(short.structuredContent).toMatchObject({ failure: { code: "query-too-short" } });
    expect(contactStore.reads).toBe(0);
  });

  it("given a query that says nothing, refuses rather than reporting that nobody was found", async () => {
    const result = await findContacts({ query: "  " });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
  });

  // upstream #65; morquis 96759b3: a refused permission read as "no such contact".
  it("given contacts access was refused, refuses with a permission failure naming the setting, rather than finding nobody", async () => {
    contactStore.refuses(contactsRefused);

    const result = await findContacts({ query: "sam" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "contacts_permission_missing",
        sentence: expect.stringContaining("Privacy & Security > Contacts") as string,
      },
    });
  });
});
