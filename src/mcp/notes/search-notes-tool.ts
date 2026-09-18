import { z } from "zod";

import type { NotesDependencies } from "../../application/notes/note-store.js";
import {
  defaultNoteLimit,
  greatestNoteLimit,
  searchNotes,
} from "../../application/notes/search-notes.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { asNoteFolderRecord, asNoteRecord, noteFolderRecord, noteRecord } from "./records.js";

export const searchNotesTool = (dependencies: NotesDependencies): Tool =>
  tool({
    name: "search_notes",
    title: "Search notes",
    description:
      "The notes whose title or text mentions some text, ignoring case, most recently " +
      "modified first, each with its note folder and notes account and never its text. The " +
      "search text is matched exactly as written: it is not a pattern. Every note folder is " +
      "searched, and the coverage says how many answered, names any that did not, and counts " +
      "the notes whose text would not be read. A truncated answer says where the next page " +
      "starts.",
    input: {
      text: z
        .string()
        .refine((text) => text.trim() !== "", "Search text has to say something.")
        .describe("The text to look for, matched exactly as written."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(greatestNoteLimit)
        .optional()
        .describe(`The most notes to report. Defaults to ${String(defaultNoteLimit)}.`),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Where the page starts: the nextOffset a truncated answer gave. Defaults to 0."),
    },
    output: {
      notes: z.array(noteRecord),
      coverage: z.object({
        notesFound: z.number().int().describe("How many notes mention it, on every page."),
        noteFoldersSearched: z.number().int(),
        noteFoldersUnread: z.array(noteFolderRecord),
        noteFoldersExcluded: z.number().int(),
        notesUnread: z.number().int().describe("Notes whose text would not be read."),
        truncated: z.boolean(),
        nextOffset: z.number().int().optional(),
      }),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ text, limit, offset }) => {
      const searched = await searchNotes(dependencies, {
        searchText: text,
        ...(limit === undefined ? {} : { limit }),
        ...(offset === undefined ? {} : { offset }),
      });

      if (!searched.ok) return refusing(searched.failure);

      const { notes, nextOffset, noteFoldersUnread, ...counts } = searched.value;

      return reporting({
        notes: notes.map(asNoteRecord),
        coverage: {
          ...counts,
          noteFoldersUnread: noteFoldersUnread.map(asNoteFolderRecord),
          truncated: nextOffset !== undefined,
          ...(nextOffset === undefined ? {} : { nextOffset }),
        },
      });
    },
  });
