/** One labelled detail of a contact. The label is the contact's own: "mobile", "work", "Mum's". */
export type PhoneNumber = { readonly label: string; readonly written: string };
export type EmailAddress = { readonly label: string; readonly address: string };
export type Url = { readonly label: string; readonly url: string };

export type PostalAddress = {
  readonly label: string;
  readonly street: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly country: string;
};

/**
 * A person or company in Contacts. It has no note: macOS keeps that field for apps Apple has
 * entitled, and this server never asks for it.
 */
export type Contact = {
  readonly identifier: string;
  readonly namePrefix: string;
  readonly givenName: string;
  readonly middleName: string;
  readonly familyName: string;
  readonly nameSuffix: string;
  readonly nickname: string;
  readonly organisation: string;
  readonly jobTitle: string;
  readonly phoneNumbers: readonly PhoneNumber[];
  readonly emailAddresses: readonly EmailAddress[];
  readonly postalAddresses: readonly PostalAddress[];
  readonly urls: readonly Url[];
};

const joined = (...parts: readonly string[]): string =>
  parts.filter((part) => part !== "").join(" ");

/** The name a contact goes by: the person's, or the company's when there is no person. */
export const nameOf = ({ givenName, familyName, organisation }: Contact): string =>
  joined(givenName, familyName) || organisation;

/** A script written without spaces between a person's names, family name first. */
const writtenWithoutSpaces =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * Every name a contact could be asked for by: the name it goes by, the name in full, its
 * nickname and its organisation, and for a name in Chinese, Japanese or Korean the way it is
 * actually written, family name first with nothing in between.
 */
export const namesOf = (contact: Contact): readonly string[] => {
  const { namePrefix, givenName, middleName, familyName, nameSuffix } = contact;
  const asWritten = writtenWithoutSpaces.test(givenName + familyName)
    ? `${familyName}${givenName}`
    : "";

  return [
    nameOf(contact),
    joined(namePrefix, givenName, middleName, familyName, nameSuffix),
    asWritten,
    contact.nickname,
    contact.organisation,
  ].filter((name) => name !== "");
};

/** Apple writes its own labels as `_$!<Mobile>!$_`. A label the user typed is written as typed. */
const appleLabel = /^_\$!<(?<name>.+)>!\$_$/u;

/**
 * A label as a person would say it. Apple's own become plain lower-case words, whatever kind
 * of detail they are on: `_$!<WorkFAX>!$_` is "work fax". A custom label is left exactly as is.
 */
export const labelFrom = (stored: string): string => {
  const name = appleLabel.exec(stored)?.groups?.name;

  if (name === undefined) return stored;

  return name
    .replace(/(?<=[a-z])(?=[A-Z])/gu, " ")
    .toLowerCase();
};
