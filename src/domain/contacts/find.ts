import type { NamedFailure } from "../failure.js";
import { namesOf, nameOf, type Contact } from "./contact.js";
import { nameMatch, nameMatches } from "./name-match.js";
import { looksLikeANumber, sameNumber } from "./phone-number.js";

/**
 * How a contact came to be found. Some text is looked for in one way only, except that digits
 * may be a number or a name, so the order matters only among names and between those two.
 */
export const matches = ["phone number", "email address", ...nameMatches] as const;

export type Match = (typeof matches)[number];

export type FoundContact = { readonly contact: Contact; readonly match: Match };

/** Fewer letters and digits than this, and the text is part of nearly every email address. */
const fewestInPartOfAnAddress = 3;

const tooShort: NamedFailure = {
  code: "query-too-short",
  sentence:
    "Nobody was looked for: part of an email address needs at least three letters or digits " +
    "beside the @, or it would find nearly everybody.",
};

const lettersAndDigitsIn = (text: string): number => text.replace(/[^\p{L}\p{N}]/gu, "").length;

const matchOf = (text: string, contact: Contact): Match | undefined => {
  if (text.includes("@")) {
    const sought = text.trim().toLowerCase();
    return contact.emailAddresses.some(({ address }) => address.toLowerCase().includes(sought))
      ? "email address"
      : undefined;
  }

  const isTheirNumber =
    looksLikeANumber(text) &&
    contact.phoneNumbers.some(({ written }) => sameNumber(written, text));

  if (isTheirNumber) return "phone number";

  return nameMatch(text, namesOf(contact));
};

/**
 * Why some text is too little to look for anybody with, or nothing when it is enough. It is
 * asked before the contacts are read, so text that would find nearly everybody reads nobody.
 */
export const tooLittleToFind = (text: string): NamedFailure | undefined =>
  text.includes("@") && lettersAndDigitsIn(text) < fewestInPartOfAnAddress ? tooShort : undefined;

/**
 * Every contact some text finds, best match first, and never one chosen for the caller: two
 * people called Sam are two contacts found (KassebaumEngineering 1d47e74 merged them into one,
 * with one's number and the other's address).
 *
 * Text with an `@` is part of an email address. Digits are a phone number, and a name too,
 * since a company can be called 365. Anything else is a name.
 */
export const find = (text: string, contacts: readonly Contact[]): readonly FoundContact[] =>
  contacts
    .flatMap((contact) => {
      const match = matchOf(text, contact);
      return match === undefined ? [] : [{ contact, match }];
    })
    .sort(
      (left, right) =>
        matches.indexOf(left.match) - matches.indexOf(right.match) ||
        nameOf(left.contact).localeCompare(nameOf(right.contact)) ||
        left.contact.identifier.localeCompare(right.contact.identifier),
    );
