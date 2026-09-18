/**
 * Phone numbers, compared in full and never by their tails.
 *
 * A number that states its country, with a plus, has an E.164 form. A bare national number has
 * none: the answer must not depend on which region the Mac is set to (#17; faces-sh read a
 * bare number in the machine's region and sent to the wrong country). Two numbers are the same
 * only when the whole of them agrees, because a loose `contains` has already sent a message
 * to the wrong person (upstream #35).
 */

/** Marks that direct text and show nothing, which a pasted number arrives wrapped in. */
const invisibleMarks = /\p{Cf}/gu;

/** An extension dialled after the number has answered: no part of the number itself. */
const extension = /(?:;ext=|\bext\.?|x)\s*\d+$/iu;

/** A trunk zero written in brackets is dialled inside the country and dropped outside it. */
const bracketedTrunkZero = /\(0\)/gu;

/** What a written number may hold besides digits: spacing, brackets, and one leading plus. */
const phoneCharacters = /^\(?\+?[\d\s().-]+$/u;

/** The number as written, without what is not the number. */
const tidied = (written: string): string =>
  written.replace(invisibleMarks, "").trim().replace(extension, "").trim();

const digitsOf = (written: string): string => tidied(written).replace(/\D/gu, "");

/** Whether some text could be a phone number at all: digits, and the marks written round them. */
export const looksLikeANumber = (text: string): boolean =>
  phoneCharacters.test(tidied(text)) && digitsOf(text).length >= 3;

/**
 * The calling codes of two digits. Codes of one digit are 1 and 7, and every other code has
 * three. No code is the start of another, so a number states its country in exactly one way.
 */
const twoDigitCodes = new Set(
  (
    "20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 " +
    "60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98"
  ).split(" "),
);

/** Italy's numbers begin with a zero that is part of the number and is dialled from abroad. */
const codesThatKeepTheirZero = new Set(["39"]);

const callingCodeOf = (digits: string): string => {
  if (digits.startsWith("1") || digits.startsWith("7")) return digits.slice(0, 1);
  return digits.slice(0, twoDigitCodes.has(digits.slice(0, 2)) ? 2 : 3);
};

/**
 * The E.164 form of a number that states its country. A zero straight after the country code
 * is a trunk prefix in most countries and part of the number in a few, so outside those few
 * the number has no E.164 form rather than a guessed one.
 */
export const e164 = (written: string): string | undefined => {
  const text = tidied(written);

  if (!phoneCharacters.test(text) || !/^\(?\+/u.test(text)) return undefined;

  const digits = text.replace(bracketedTrunkZero, "").replace(/\D/gu, "");
  const code = callingCodeOf(digits);
  const national = digits.slice(code.length);

  if (digits.startsWith("0") || digits.length < 4 || digits.length > 15) return undefined;
  if (national.startsWith("0") && !codesThatKeepTheirZero.has(code)) return undefined;

  return `+${digits}`;
};

/** A bare national number as it could appear after a country code: as written, or less its zero. */
const nationalForms = (bare: string): readonly string[] => [bare, bare.replace(/^0/u, "")];

/**
 * Whether two written numbers are the same number. Both stating their country, their E.164
 * forms are equal. Neither stating it, their digits are. One stating it, the bare one equals
 * the other's national part, with its trunk zero or without, or all of its digits when it
 * was written with its country code and no plus. A bare number says nothing about which
 * country it is in: a caller may find it in two, and shows both.
 */
export const sameNumber = (left: string, right: string): boolean => {
  const [leftE164, rightE164] = [e164(left), e164(right)];

  if (leftE164 !== undefined && rightE164 !== undefined) return leftE164 === rightE164;

  if (leftE164 === undefined && rightE164 === undefined) {
    return digitsOf(left) !== "" && digitsOf(left) === digitsOf(right);
  }

  const international = (leftE164 ?? rightE164 ?? "").slice(1);
  const bare = digitsOf(leftE164 === undefined ? left : right);
  const national = international.slice(callingCodeOf(international).length);

  return bare !== "" && (bare === international || nationalForms(bare).includes(national));
};
