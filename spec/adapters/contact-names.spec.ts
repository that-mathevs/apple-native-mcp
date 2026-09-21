import { describe, expect, it } from "vitest";

import { contactNamesFrom } from "../../src/adapters/contact-names.js";
import { aContact, contactsRefused, FakeContactStore } from "../support/fake-contact-store.js";

// Messages names a handle through its own port, and the contact store answers it: the rule for
// which contact holds a handle is the Contacts context's own (contactReachedAt).

describe("the contact names messages are given", () => {
  it("names each handle exactly one contact holds by the name that contact goes by, and no other", async () => {
    const contactStore = new FakeContactStore();
    contactStore.holds(
      aContact("contact-anna", "Anna", "Reyes", {
        phoneNumbers: [{ label: "mobile", written: "+1 (555) 123-0001" }],
      }),
    );

    const named = await contactNamesFrom(contactStore).namesOf(
      ["+15551230001", "+15559990000"],
      [],
    );

    expect(named).toStrictEqual({ ok: true, value: new Map([["+15551230001", "Anna Reyes"]]) });
  });

  it("given contacts that cannot be read, answers why rather than naming nobody", async () => {
    const contactStore = new FakeContactStore();
    contactStore.refuses(contactsRefused);

    const named = await contactNamesFrom(contactStore).namesOf(["+15551230001"], []);

    expect(named).toMatchObject({ ok: false, failure: { code: "contacts-permission-missing" } });
  });

  // MSG-15 and upstream #58: one read of the whole address book per message took minutes.
  it("reads the contacts once, however many handles it names", async () => {
    const contactStore = new FakeContactStore();
    const handles = ["+15551230001", "+15551230002", "a@b.example"];

    await contactNamesFrom(contactStore).namesOf(handles, handles);

    expect(contactStore.reads).toBe(1);
  });

  it("given a bare number on a card, names a handle only when no stored handle in another country fits it", async () => {
    const contactStore = new FakeContactStore();
    contactStore.holds(
      aContact("contact-anna", "Anna", "Reyes", {
        phoneNumbers: [{ label: "mobile", written: "07700 900123" }],
      }),
    );

    const named = await contactNamesFrom(contactStore).namesOf(
      ["+337700900123"],
      ["+447700900123", "+337700900123"],
    );

    expect(named).toStrictEqual({ ok: true, value: new Map() });
  });
});
