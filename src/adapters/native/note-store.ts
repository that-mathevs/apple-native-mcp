import type { NotesMentioning, NoteStore } from "../../application/notes/note-store.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { IndexedNote, Note, NoteFolder } from "../../domain/notes/note.js";
import type { Helper } from "./helper.js";

/**
 * The note store as the helper answers it.
 *
 * Nothing here decides anything: it asks the helper, which alone may script Notes, and turns
 * the records it sends back into the domain's words. Which note folders are searched, and the
 * order notes come in, live above it; what mentions the search text is the helper's rule, so
 * that only the notes found ever leave it.
 */

type NoteFolderRecord = {
  readonly identifier: string;
  readonly name: string;
  readonly account: { readonly identifier: string; readonly name: string };
};

/** A note a search found. The helper names only the identifier of the note folder it read. */
type FoundNoteRecord = {
  readonly identifier: string;
  readonly title: string;
  readonly modified: string;
  readonly isLocked: boolean;
  readonly noteFolder: string;
};

type NoteInFullRecord = Omit<FoundNoteRecord, "noteFolder"> & {
  readonly noteFolder: NoteFolderRecord;
  readonly text: string | null;
  readonly textUnread: boolean;
  readonly attachments: number;
};

const asNoteFolder = ({ identifier, name, account }: NoteFolderRecord): NoteFolder => ({
  identifier,
  name,
  account: { identifier: account.identifier, name: account.name },
});

const identifiersOf = (noteFolders: readonly NoteFolder[]): readonly string[] =>
  noteFolders.map(({ identifier }) => identifier);

/**
 * A note found, with the note folder it was read from. That folder is one of those the search
 * was asked about, so a record naming any other is left out rather than given a folder by guess.
 */
const asIndexedNote =
  (searched: readonly NoteFolder[]) =>
  (record: FoundNoteRecord): readonly IndexedNote[] => {
    const noteFolder = searched.find(({ identifier }) => identifier === record.noteFolder);

    if (noteFolder === undefined) return [];

    return [
      {
        identifier: record.identifier,
        title: record.title,
        modified: new Date(record.modified),
        isLocked: record.isLocked,
        noteFolder,
      },
    ];
  };

const asNote = (record: NoteInFullRecord): Note => ({
  identifier: record.identifier,
  title: record.title,
  modified: new Date(record.modified),
  isLocked: record.isLocked,
  noteFolder: asNoteFolder(record.noteFolder),
  ...(record.text === null ? {} : { text: record.text }),
  textUnread: record.textUnread,
  attachments: record.attachments,
});

export const helperNoteStore = (helper: Helper): NoteStore => ({
  noteFolders: async (): Promise<Outcome<readonly NoteFolder[]>> => {
    const answered = await helper.ask({ request: "note_folders" });

    if (!answered.ok) return failed(answered.failure);

    const { noteFolders } = answered.value as { noteFolders?: NoteFolderRecord[] };

    return succeeded((noteFolders ?? []).map(asNoteFolder));
  },

  notesMentioning: async (
    searchText: string,
    noteFolders: readonly NoteFolder[],
  ): Promise<Outcome<NotesMentioning>> => {
    const answered = await helper.ask({
      request: "notes_mentioning",
      text: searchText,
      noteFolders: identifiersOf(noteFolders),
    });

    if (!answered.ok) return failed(answered.failure);

    const { notes, unreadNoteFolders, notesUnread } = answered.value as {
      notes?: FoundNoteRecord[];
      unreadNoteFolders?: { readonly noteFolder: string }[];
      notesUnread?: number;
    };

    return succeeded({
      notes: (notes ?? []).flatMap(asIndexedNote(noteFolders)),
      unreadNoteFolders: (unreadNoteFolders ?? []).map(({ noteFolder }) => noteFolder),
      notesUnread: notesUnread ?? 0,
    });
  },

  note: async (
    identifier: string,
    noteFolders: readonly NoteFolder[],
  ): Promise<Outcome<Note | undefined>> => {
    const answered = await helper.ask({
      request: "note",
      identifier,
      noteFolders: identifiersOf(noteFolders),
    });

    if (!answered.ok) return failed(answered.failure);

    const { note } = answered.value as { note?: NoteInFullRecord | null };

    return succeeded(note === undefined || note === null ? undefined : asNote(note));
  },
});
