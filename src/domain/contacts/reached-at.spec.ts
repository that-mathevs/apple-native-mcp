import { describe, expect, it } from "vitest";

import type { Contact } from "./contact.js";
import { contactReachedAt } from "./reached-at.js";

// Which contact a handle in Messages belongs to, for putting a name beside it. A name beside the
// wrong handle is worse than none: it tells an agent that a stranger is someone the user knows.

const aContact = (identifier: string, details: Partial<Contact>): Contact => ({
  identifier,
  namePrefix: "",
  givenName: identifier,
  middleName: "",
  familyName: "",
  nameSuffix: "",
  nickname: "",
  organisation: "",
  jobTitle: "",
  phoneNumbers: [],
  emailAddresses: [],
  postalAddresses: [],
  urls: [],
  ...details,
});

const aNumber = (written: string): { label: string; written: string } => ({ label: "", written });

describe("the contact a handle belongs to", () => {
  it("given a number written with spaces on a card, finds the contact for the same number in E.164", () => {
    const anna = aContact("Anna", { phoneNumbers: [aNumber("+44 7700 900123")] });

    expect(contactReachedAt("+447700900123", [anna], [])).toBe(anna);
  });

  it("given an email address, finds the contact whatever its case", () => {
    const ben = aContact("Ben", { emailAddresses: [{ label: "", address: "Ben@Example.com" }] });

    expect(contactReachedAt("ben@example.com", [ben], [])).toBe(ben);
  });

  // Upstream #35: a loose contains matched a number to the wrong person.
  it("given a card whose number only ends the same, finds nobody: numbers match in full", () => {
    const stranger = aContact("Stranger", { phoneNumbers: [aNumber("+1 212 700 900123")] });

    expect(contactReachedAt("+447700900123", [stranger], [])).toBeUndefined();
  });

  // #17: a bare national number on a card says nothing about its country, and can fit handles in
  // two. Naming only one contact that fits never puts a wrong name beside a handle.
  it("given two contacts the handle could belong to, names neither", () => {
    const anna = aContact("Anna", { phoneNumbers: [aNumber("07700 900123")] });
    const anne = aContact("Anne", { phoneNumbers: [aNumber("+44 7700 900123")] });

    expect(contactReachedAt("+447700900123", [anna, anne], [])).toBeUndefined();
  });

  it("given one contact with the handle on it twice, still finds that one contact", () => {
    const anna = aContact("Anna", {
      phoneNumbers: [aNumber("+44 7700 900123"), aNumber("07700 900123")],
    });

    expect(contactReachedAt("+447700900123", [anna], [])).toBe(anna);
  });

  it("given a sender id of letters, which no card holds, finds nobody", () => {
    const bank = aContact("Bank", { organisation: "BANK" });

    expect(contactReachedAt("BANK", [bank], [])).toBeUndefined();
  });

  // #17 and MSG-55: a bare national number says nothing about its country. It names a handle only
  // while no handle stored in another country has the same digits, since that stranger would
  // read as the contact too.
  it("given a bare number on a card and a stored handle in another country with its digits, names neither", () => {
    const anna = aContact("Anna", { phoneNumbers: [aNumber("07700 900123")] });
    const stored = ["+447700900123", "+337700900123"];

    expect(contactReachedAt("+447700900123", [anna], stored)).toBeUndefined();
    expect(contactReachedAt("+337700900123", [anna], stored)).toBeUndefined();
  });

  it("given a bare number on a card that only one stored handle fits, names that handle", () => {
    const anna = aContact("Anna", { phoneNumbers: [aNumber("07700 900123")] });

    const stored = ["+447700900123", "+15551230001"];

    expect(contactReachedAt("+447700900123", [anna], stored)).toBe(anna);
  });

  it("given a number on a card that states its country, names its handle whatever else is stored", () => {
    const anna = aContact("Anna", { phoneNumbers: [aNumber("+44 7700 900123")] });

    const stored = ["+447700900123", "+337700900123"];

    expect(contactReachedAt("+447700900123", [anna], stored)).toBe(anna);
  });
});
