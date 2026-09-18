/** A top-level Notes container such as iCloud or On My Mac. It owns note folders. */
export type NotesAccount = { readonly identifier: string; readonly name: string };

/**
 * A container of notes inside a notes account. Every account has a folder called Notes, so a
 * name is never enough: the identifier addresses it, and the account tells a reader which.
 */
export type NoteFolder = {
  readonly identifier: string;
  readonly name: string;
  readonly account: NotesAccount;
};

/** A note as an index reports it: enough to choose one, and never its text. */
export type IndexedNote = {
  readonly identifier: string;
  /** The name the store reports. It is read and never computed from the text (#23). */
  readonly title: string;
  readonly modified: Date;
  /** A locked note's text can't be read. It is said to be locked, never shown as empty. */
  readonly isLocked: boolean;
  readonly noteFolder: NoteFolder;
};

/** A note in full. Its text may be external content: a shared note holds other people's. */
export type Note = IndexedNote & {
  /** The plain-text view of the note. A locked note has none, and nor does one left unread. */
  readonly text?: string;
  /** The text would not be read, which is not the same as a note that says nothing. */
  readonly textUnread: boolean;
  /** How many attachments the note holds, which its text leaves out. */
  readonly attachments: number;
};

/** Most recently modified first, then by title, so the same notes always read the same way. */
export const mostRecentFirst = <Listed extends IndexedNote>(
  notes: readonly Listed[],
): readonly Listed[] =>
  [...notes].sort(
    (left, right) =>
      right.modified.getTime() - left.modified.getTime() ||
      left.title.localeCompare(right.title) ||
      left.identifier.localeCompare(right.identifier),
  );

/** A locked note's text is never passed on, whatever a store handed over. */
export const withoutLockedText = ({ text, ...note }: Note): Note =>
  note.isLocked || text === undefined ? note : { ...note, text };
