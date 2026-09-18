import { describe, expect, it } from "vitest";

import { FakeNoteStore, notesRefused } from "../../support/fake-note-store.js";
import { aClientOfNotes, iCloudNotes, journal, localNotes } from "../../support/notes-server.js";

// What an agent learns about where notes are kept. Every notes account has a folder called
// Notes, so upstream's "the Notes folder" was whichever account answered first (morquis
// 05d1658, upstream #67).

const listing = async (
  configuration: Record<string, string> = {},
  noteStore = new FakeNoteStore(),
): Promise<{ structuredContent?: unknown; isError?: unknown; text: string }> => {
  noteStore.holdsNoteFolders(iCloudNotes, localNotes, journal);

  const client = await aClientOfNotes(noteStore, configuration);
  const result = await client.callTool({ name: "list_note_folders", arguments: {} });

  return { ...result, text: JSON.stringify(result) };
};

describe("listing note folders", () => {
  it("reports each note folder with its identifier and its notes account, so two folders with the same name in different accounts stay apart", async () => {
    const result = await listing();

    expect(result.structuredContent).toMatchObject({
      noteFolders: [
        { identifier: "folder-1", name: "Notes", account: { name: "iCloud" } },
        { identifier: "folder-2", name: "Notes", account: { name: "On My Mac" } },
        { identifier: "folder-3", name: "Journal", account: { name: "iCloud" } },
      ],
    });
  });

  it("given note folders the settings exclude, leaves them out and says how many, never which", async () => {
    const result = await listing({ APPLE_NATIVE_MCP_EXCLUDED_NOTE_FOLDERS: "folder-3" });

    expect(result.structuredContent).toMatchObject({
      noteFolders: [{ identifier: "folder-1" }, { identifier: "folder-2" }],
      coverage: { noteFoldersExcluded: 1 },
    });
    expect(result.text).not.toContain("Journal");
    expect(result.text).not.toContain("folder-3");
  });

  // danielk-am 9d9122c, upstream #43, #44: a refused permission read as "you have no notes".
  it("given Notes may not be controlled, refuses with a permission failure naming the setting, rather than reporting no note folders", async () => {
    const noteStore = new FakeNoteStore();
    noteStore.refuses(notesRefused);

    const result = await listing({}, noteStore);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "notes_permission_missing",
        sentence: expect.stringContaining("Automation") as string,
      },
    });
  });
});
