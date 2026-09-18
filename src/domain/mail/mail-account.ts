/**
 * A configured account in Mail. Display names aren't unique, so the identifier Mail gives the
 * account is what addresses it.
 */
export type MailAccount = {
  readonly identifier: string;
  readonly name: string;
  readonly emailAddresses: readonly string[];
};
