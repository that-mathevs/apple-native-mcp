import { describe, expect, it } from "vitest";

import type { ContactStore } from "../../src/application/contacts/contact-store.js";

/**
 * What every contact store promises, whichever way it reaches macOS: against the fake
 * everywhere, and against the real store on a Mac with contacts access.
 */
export type ContactStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly contactStore: ContactStore }>;
};

const labelled = (value: string): Record<string, unknown> => ({
  label: expect.any(String) as string,
  [value]: expect.any(String) as string,
});

export const aContactStore = ({ name, build }: ContactStoreUnderTest): void => {
  describe(`${name}, as a contact store`, () => {
    it("answers with contacts rather than a failure: a contact store that can be read always answers", async () => {
      const { contactStore } = await build();

      expect(await contactStore.contacts()).toMatchObject({ ok: true });
    });

    // morquis 5c01104: asking the framework for the note without Apple's entitlement fails the
    // whole fetch, so the shape of a contact is fixed here, note left out, for both stores.
    it("gives every contact its identifier, its names and every kind of detail with a label, and never a note", async () => {
      const { contactStore } = await build();

      const read = await contactStore.contacts();

      expect(read.ok).toBe(true);
      for (const contact of read.ok ? read.value : []) {
        expect(contact).toStrictEqual({
          identifier: expect.any(String) as string,
          namePrefix: expect.any(String) as string,
          givenName: expect.any(String) as string,
          middleName: expect.any(String) as string,
          familyName: expect.any(String) as string,
          nameSuffix: expect.any(String) as string,
          nickname: expect.any(String) as string,
          organisation: expect.any(String) as string,
          jobTitle: expect.any(String) as string,
          phoneNumbers: expect.any(Array) as unknown[],
          emailAddresses: expect.any(Array) as unknown[],
          postalAddresses: expect.any(Array) as unknown[],
          urls: expect.any(Array) as unknown[],
        });
        for (const number of contact.phoneNumbers) {
          expect(number).toStrictEqual(labelled("written"));
        }
        for (const email of contact.emailAddresses) {
          expect(email).toStrictEqual(labelled("address"));
        }
        for (const url of contact.urls) expect(url).toStrictEqual(labelled("url"));
      }
    });
  });
};
