import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { mostRecentFirst, type IndexedNote, type NoteFolder } from "../../domain/notes/note.js";
import { excludes } from "../../domain/settings.js";
import type { NotesDependencies } from "./note-store.js";

/** How many notes a page holds when the caller names no limit, and the most it may name. */
export const defaultNoteLimit = 25;
export const greatestNoteLimit = 100;

export type SearchNotesRequest = {
  readonly searchText: string;
  readonly limit?: number;
  /** Where the page starts: the next offset a truncated answer stated. */
  readonly offset?: number;
};

export type NoteIndex = {
  readonly notes: readonly IndexedNote[];
  /** How many notes mention the search text in all, whatever the page holds. */
  readonly notesFound: number;
  /** How many note folders answered, so finding nothing is never read as there being nothing. */
  readonly noteFoldersSearched: number;
  /** The note folders that were asked and didn't answer, named so they can be tried again. */
  readonly noteFoldersUnread: readonly NoteFolder[];
  readonly noteFoldersExcluded: number;
  /** How many notes' text would not be read, so could not be searched. */
  readonly notesUnread: number;
  /** Where the next page starts, when the limit left notes behind. */
  readonly nextOffset?: number;
};

/**
 * The notes that mention the search text, most recently modified first, a page at a time.
 *
 * The store is asked to search only the note folders the agent may see, so a folder the
 * settings exclude is never read at all, and only the notes found ever leave the store.
 */
export const searchNotes = async (
  { noteStore, settings }: NotesDependencies,
  { searchText, limit = defaultNoteLimit, offset = 0 }: SearchNotesRequest,
): Promise<Outcome<NoteIndex>> => {
  const folders = await noteStore.noteFolders();
  if (!folders.ok) return folders;

  const searchable = folders.value.filter(
    ({ identifier }) => !excludes(settings.noteFolders, identifier),
  );
  const noteFoldersExcluded = folders.value.length - searchable.length;

  if (searchable.length === 0) {
    return succeeded({
      notes: [],
      notesFound: 0,
      noteFoldersSearched: 0,
      noteFoldersUnread: [],
      noteFoldersExcluded,
      notesUnread: 0,
    });
  }

  const found = await noteStore.notesMentioning(searchText, searchable);
  if (!found.ok) return found;

  const notes = mostRecentFirst(found.value.notes);
  const end = offset + limit;
  const noteFoldersUnread = searchable.filter(({ identifier }) =>
    found.value.unreadNoteFolders.includes(identifier),
  );

  return succeeded({
    notes: notes.slice(offset, end),
    notesFound: notes.length,
    noteFoldersSearched: searchable.length - noteFoldersUnread.length,
    noteFoldersUnread,
    noteFoldersExcluded,
    notesUnread: found.value.notesUnread,
    ...(notes.length > end ? { nextOffset: end } : {}),
  });
};
