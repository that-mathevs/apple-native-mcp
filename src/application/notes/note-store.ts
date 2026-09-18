import type { Outcome } from "../../domain/failure.js";
import type { IndexedNote, Note, NoteFolder } from "../../domain/notes/note.js";
import type { Settings } from "../../domain/settings.js";

/** What a search of some note folders found, and what of them would not be read. */
export type NotesMentioning = {
  readonly notes: readonly IndexedNote[];
  /** The identifiers of note folders that were asked and didn't answer. */
  readonly unreadNoteFolders: readonly string[];
  /** How many notes' text would not be read, so could not be searched. */
  readonly notesUnread: number;
};

/** The store notes are read from. The helper implements it; a fake stands in for specs. */
export type NoteStore = {
  /** Every note folder of every notes account. */
  noteFolders: () => Promise<Outcome<readonly NoteFolder[]>>;
  /**
   * The notes in these note folders whose title or text mentions the search text, ignoring
   * case, each once. Only the notes found leave the store: a search never hands a whole library
   * of notes to its caller.
   */
  notesMentioning: (
    searchText: string,
    noteFolders: readonly NoteFolder[],
  ) => Promise<Outcome<NotesMentioning>>;
  /**
   * One note in full, or nothing when none of these note folders holds a note with that
   * identifier. Its text is read only once it is known to be kept in one of them.
   */
  note: (
    identifier: string,
    noteFolders: readonly NoteFolder[],
  ) => Promise<Outcome<Note | undefined>>;
};

/** What every notes use case is handed. */
export type NotesDependencies = {
  readonly noteStore: NoteStore;
  readonly settings: Settings;
};
