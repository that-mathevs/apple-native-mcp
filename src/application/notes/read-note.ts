import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { withoutLockedText, type Note } from "../../domain/notes/note.js";
import { excludes } from "../../domain/settings.js";
import type { NotesDependencies } from "./note-store.js";

const noSuchNote: NamedFailure = {
  code: "note-not-found",
  sentence: "No note has that identifier.",
};

/**
 * One note in full.
 *
 * The store is told which note folders the note may be read from, so the text of a note kept
 * in a folder the settings exclude is never read at all, and such a note answers exactly as one
 * that doesn't exist: an identifier learnt elsewhere can't be used to find out that it does.
 */
export const readNote = async (
  { noteStore, settings }: NotesDependencies,
  identifier: string,
): Promise<Outcome<Note>> => {
  const folders = await noteStore.noteFolders();
  if (!folders.ok) return folders;

  const readable = folders.value.filter(
    (noteFolder) => !excludes(settings.noteFolders, noteFolder.identifier),
  );

  const read = await noteStore.note(identifier, readable);
  if (!read.ok) return read;

  const found = read.value;

  if (found === undefined || excludes(settings.noteFolders, found.noteFolder.identifier)) {
    return failed(noSuchNote);
  }

  return succeeded(withoutLockedText(found));
};
