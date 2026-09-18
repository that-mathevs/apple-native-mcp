import { z } from "zod";

import type { NotesDependencies } from "../../application/notes/note-store.js";
import { readNote } from "../../application/notes/read-note.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { asNoteRecord, noteRecord } from "./records.js";

export const readNoteTool = (dependencies: NotesDependencies): Tool =>
  tool({
    name: "read_note",
    title: "Read one note",
    description:
      "One note in full, by its identifier: its text, where it is kept and how many " +
      "attachments its text leaves out. A locked note is reported as locked, with no text, " +
      "and so is one whose text would not be read.",
    input: {
      identifier: z.string().min(1).describe("The note identifier, as an index reported it."),
    },
    output: {
      note: noteRecord.extend({
        text: z
          .string()
          .optional()
          .describe("May be external content: a shared note holds other people's text."),
        textUnread: z
          .boolean()
          .describe("The text would not be read. This is not a note that says nothing."),
        attachments: z.number().int().describe("How many attachments the text leaves out."),
      }),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ identifier }) => {
      const read = await readNote(dependencies, identifier);

      if (!read.ok) return refusing(read.failure);

      const { text, textUnread, attachments } = read.value;

      return reporting({
        note: {
          ...asNoteRecord(read.value),
          ...(text === undefined ? {} : { text }),
          textUnread,
          attachments,
        },
      });
    },
  });
