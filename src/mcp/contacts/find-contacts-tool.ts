import { z } from "zod";

import {
  defaultContactLimit,
  findContacts,
  greatestContactLimit,
  type FindContactsDependencies,
} from "../../application/contacts/find-contacts.js";
import { labelFrom, nameOf } from "../../domain/contacts/contact.js";
import { matches, type FoundContact } from "../../domain/contacts/find.js";
import { e164 } from "../../domain/contacts/phone-number.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";

const label = z.string().describe("The contact's own label for this detail, such as mobile.");

const contactRecord = z.object({
  identifier: z.string(),
  name: z.string(),
  match: z.enum(matches).describe("How the query found this contact."),
  namePrefix: z.string(),
  givenName: z.string(),
  middleName: z.string(),
  familyName: z.string(),
  nameSuffix: z.string(),
  nickname: z.string(),
  organisation: z.string(),
  jobTitle: z.string(),
  phoneNumbers: z.array(
    z.object({
      label,
      written: z.string().describe("The number as the contact holds it."),
      e164: z
        .string()
        .optional()
        .describe("Set when the number states its country. A bare number is never given one."),
    }),
  ),
  emailAddresses: z.array(z.object({ label, address: z.string() })),
  postalAddresses: z.array(
    z.object({
      label,
      street: z.string(),
      city: z.string(),
      region: z.string(),
      postalCode: z.string(),
      country: z.string(),
    }),
  ),
  urls: z.array(z.object({ label, url: z.string() })),
});

const asRecord = ({ contact, match }: FoundContact): Record<string, unknown> => ({
  identifier: contact.identifier,
  name: nameOf(contact),
  match,
  namePrefix: contact.namePrefix,
  givenName: contact.givenName,
  middleName: contact.middleName,
  familyName: contact.familyName,
  nameSuffix: contact.nameSuffix,
  nickname: contact.nickname,
  organisation: contact.organisation,
  jobTitle: contact.jobTitle,
  phoneNumbers: contact.phoneNumbers.map(({ label: stored, written }) => {
    const international = e164(written);
    return {
      label: labelFrom(stored),
      written,
      ...(international === undefined ? {} : { e164: international }),
    };
  }),
  emailAddresses: contact.emailAddresses.map(({ label: stored, address }) => ({
    label: labelFrom(stored),
    address,
  })),
  postalAddresses: contact.postalAddresses.map(({ label: stored, ...address }) => ({
    label: labelFrom(stored),
    ...address,
  })),
  urls: contact.urls.map(({ label: stored, url }) => ({ label: labelFrom(stored), url })),
});

export const findContactsTool = (dependencies: FindContactsDependencies): Tool =>
  tool({
    name: "find_contacts",
    title: "Find contacts",
    description:
      "Every contact a name, a phone number or part of an email address finds, best match " +
      "first, each with all its phone numbers, email addresses, postal addresses and URLs. A " +
      "name matches whole words and the starts of words, never letters inside a word, and " +
      "when several contacts are found they are all returned rather than one being chosen. " +
      "A truncated answer says where the next page starts.",
    input: {
      query: z
        .string()
        .refine((text) => text.trim() !== "", "A query has to say something.")
        .describe("A name, a phone number, or part of an email address containing @."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(greatestContactLimit)
        .optional()
        .describe(`The most contacts to report. Defaults to ${String(defaultContactLimit)}.`),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Where the page starts: the nextOffset a truncated answer gave. Defaults to 0."),
    },
    output: {
      contacts: z.array(contactRecord),
      coverage: z.object({ truncated: z.boolean(), nextOffset: z.number().int().optional() }),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ query, limit, offset }) => {
      const answered = await findContacts(dependencies, {
        text: query,
        ...(limit === undefined ? {} : { limit }),
        ...(offset === undefined ? {} : { offset }),
      });

      if (!answered.ok) return refusing(answered.failure);

      const { found, nextOffset } = answered.value;

      return reporting({
        contacts: found.map(asRecord),
        coverage: {
          truncated: nextOffset !== undefined,
          ...(nextOffset === undefined ? {} : { nextOffset }),
        },
      });
    },
  });
