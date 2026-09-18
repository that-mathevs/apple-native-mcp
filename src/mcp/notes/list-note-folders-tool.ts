import { z } from "zod";

import { listNoteFolders } from "../../application/notes/list-note-folders.js";
import type { NotesDependencies } from "../../application/notes/note-store.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { asNoteFolderRecord, noteFolderRecord } from "./records.js";

export const listNoteFoldersTool = (dependencies: NotesDependencies): Tool =>
  tool({
    name: "list_note_folders",
    title: "List note folders",
    description:
      "Every note folder, with the identifier that addresses it and the notes account it " +
      "belongs to. Folder names repeat across accounts: every account has one called Notes.",
    input: {},
    output: {
      noteFolders: z.array(noteFolderRecord),
      coverage: z.object({ noteFoldersExcluded: z.number().int() }),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async () => {
      const listed = await listNoteFolders(dependencies);

      if (!listed.ok) return refusing(listed.failure);

      return reporting({
        noteFolders: listed.value.noteFolders.map(asNoteFolderRecord),
        coverage: { noteFoldersExcluded: listed.value.noteFoldersExcluded },
      });
    },
  });
