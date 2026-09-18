import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import type { NoteFolder } from "../../domain/notes/note.js";
import { excludes } from "../../domain/settings.js";
import type { NotesDependencies } from "./note-store.js";

export type NoteFolderIndex = {
  readonly noteFolders: readonly NoteFolder[];
  /** How many note folders the settings kept from the agent: a number, never which. */
  readonly noteFoldersExcluded: number;
};

export const listNoteFolders = async ({
  noteStore,
  settings,
}: NotesDependencies): Promise<Outcome<NoteFolderIndex>> => {
  const read = await noteStore.noteFolders();

  if (!read.ok) return read;

  const kept = read.value.filter(({ identifier }) => !excludes(settings.noteFolders, identifier));

  return succeeded({ noteFolders: kept, noteFoldersExcluded: read.value.length - kept.length });
};
