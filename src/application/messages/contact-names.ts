import type { NamedFailure, Outcome } from "../../domain/failure.js";

/**
 * The names the user's contacts give handles. Messages asks through this port and never reaches
 * into Contacts itself; which contact a handle belongs to is the Contacts context's rule.
 */
export type ContactNames = {
  /** The handles a contact names, each with that name; a handle no one contact holds has none. */
  namesOf: (handles: readonly string[]) => Promise<Outcome<ReadonlyMap<string, string>>>;
};

/** The names a read could put beside its handles, or why it could put none. */
export type Naming =
  | { readonly names: ReadonlyMap<string, string> }
  | { readonly unavailable: NamedFailure };

/**
 * Name every handle a read found, reading the contacts once for all of them (MSG-15) and never
 * keeping them for the next read (MSG-C12). Contacts that cannot be read cost the names, never
 * the read (MSG-16).
 */
export const naming = async (
  contactNames: ContactNames,
  handles: Iterable<string>,
): Promise<Naming> => {
  const named = await contactNames.namesOf([...new Set(handles)]);
  return named.ok ? { names: named.value } : { unavailable: named.failure };
};
