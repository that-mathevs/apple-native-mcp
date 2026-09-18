import { z } from "zod";

import type { IndexedNote, NoteFolder } from "../../domain/notes/note.js";

/** The records the notes tools share, so a note folder reads the same wherever it appears. */

export const noteFolderRecord = z.object({
  identifier: z.string(),
  name: z.string(),
  account: z.object({ identifier: z.string(), name: z.string() }),
});

export const asNoteFolderRecord = ({ identifier, name, account }: NoteFolder): unknown => ({
  identifier,
  name,
  account: { identifier: account.identifier, name: account.name },
});

/** One note as an index reports it, which a detail read adds to. Never its text. */
export const noteRecord = z.object({
  identifier: z.string(),
  title: z.string().describe("The title the store reports, which is never taken from the text."),
  modified: z.iso.datetime(),
  isLocked: z.boolean().describe("A locked note's text cannot be read or searched."),
  noteFolder: noteFolderRecord,
});

export const asNoteRecord = (note: IndexedNote): Record<string, unknown> => ({
  identifier: note.identifier,
  title: note.title,
  modified: note.modified.toISOString(),
  isLocked: note.isLocked,
  noteFolder: asNoteFolderRecord(note.noteFolder),
});
