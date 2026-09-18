import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { FakeNoteStore, notesRefused } from "../../support/fake-note-store.js";
import {
  aClientOfNotes,
  aNote,
  iCloudNotes,
  journal,
  localNotes,
} from "../../support/notes-server.js";

// What an agent finds when it searches the notes. Upstream looked at the first notes it was
// given and called that a search (neektza 5d0e84a), and built the search into an AppleScript
// string, where a quote in the text ended it (upstream #67, KassebaumEngineering 1d47e74).

const boiler = aNote("note-boiler", "Boiler", "The engineer's number is on the FRIDGE door.", {
  modified: new Date("2026-09-01T09:00:00Z"),
});
const fridge = aNote("note-fridge", "Fridge warranty", "Expires in March.", {
  modified: new Date("2026-09-12T09:00:00Z"),
  noteFolder: localNotes,
});
const diary = aNote("note-diary", "Tuesday", "Bought a fridge magnet.", { noteFolder: journal });

describe("searching notes", () => {
  let noteStore: FakeNoteStore;
  let client: Client;

  const searchNotes = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "search_notes", arguments: args });

  const searchingWith = async (configuration: Record<string, string>): Promise<void> => {
    client = await aClientOfNotes(noteStore, configuration);
  };

  beforeEach(async () => {
    noteStore = new FakeNoteStore();
    noteStore.holdsNoteFolders(iCloudNotes, localNotes, journal);
    noteStore.holds(boiler, fridge, diary);
    await searchingWith({});
  });

  // upstream #67, #22: upstream matched titles, so what a note said could not be searched for.
  it("given text that appears only deep in a note's text, or only in its title, finds the note, ignoring case, most recently modified first", async () => {
    const result = await searchNotes({ text: "fridge" });

    expect(result.structuredContent).toMatchObject({
      notes: [
        { identifier: "note-fridge", title: "Fridge warranty" },
        { identifier: "note-diary" },
        { identifier: "note-boiler", title: "Boiler" },
      ],
    });
  });

  // faces-sh 94149a2: an index that carried every note's text was 2.3 MB.
  it("reports each note it finds with its title, its note folder, its notes account and when it was modified, and never its text", async () => {
    const result = await searchNotes({ text: "engineer" });

    expect(result.structuredContent).toStrictEqual({
      notes: [
        {
          identifier: "note-boiler",
          title: "Boiler",
          modified: "2026-09-01T09:00:00.000Z",
          isLocked: false,
          noteFolder: {
            identifier: "folder-1",
            name: "Notes",
            account: { identifier: "account-icloud", name: "iCloud" },
          },
        },
      ],
      coverage: {
        notesFound: 1,
        noteFoldersSearched: 3,
        noteFoldersUnread: [],
        noteFoldersExcluded: 0,
        notesUnread: 0,
        truncated: false,
      },
    });
  });

  it("states how many note folders it searched, so finding nothing is never read as there being nothing", async () => {
    const result = await searchNotes({ text: "nothing mentions this" });

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({
      notes: [],
      coverage: { noteFoldersSearched: 3 },
    });
  });

  it("given a note folder that would not be read, still searches the others and names the one it could not read", async () => {
    noteStore.cannotRead("folder-2");

    const result = await searchNotes({ text: "fridge" });

    expect(result.structuredContent).toMatchObject({
      notes: [{ identifier: "note-diary" }, { identifier: "note-boiler" }],
      coverage: {
        noteFoldersSearched: 2,
        noteFoldersUnread: [{ identifier: "folder-2", account: { name: "On My Mac" } }],
      },
    });
  });

  // NN3: a note whose text would not come back cannot be said not to mention something.
  it("given a note whose text would not be read, says how many such notes there were, rather than treating it as a note that says nothing", async () => {
    noteStore.cannotReadTheTextOf("note-boiler");

    const result = await searchNotes({ text: "engineer" });

    expect(result.structuredContent).toMatchObject({ notes: [], coverage: { notesUnread: 1 } });
  });

  it("given a note folder the settings exclude, never asks the store to search it, and never finds its notes", async () => {
    await searchingWith({ APPLE_NATIVE_MCP_EXCLUDED_NOTE_FOLDERS: "folder-3" });

    const result = await searchNotes({ text: "fridge" });

    expect(result.structuredContent).toMatchObject({
      notes: [{ identifier: "note-fridge" }, { identifier: "note-boiler" }],
      coverage: { noteFoldersExcluded: 1 },
    });
    expect(noteStore.searched).toStrictEqual([
      { searchText: "fridge", noteFolders: ["folder-1", "folder-2"] },
    ]);
  });

  it("given every note folder is excluded, finds nothing without asking the store at all", async () => {
    await searchingWith({ APPLE_NATIVE_MCP_NOTE_FOLDER_ALLOWLIST: "" });

    const result = await searchNotes({ text: "fridge" });

    expect(result.structuredContent).toMatchObject({
      notes: [],
      coverage: { noteFoldersSearched: 0, noteFoldersExcluded: 3 },
    });
    expect(noteStore.searched).toStrictEqual([]);
  });

  it("given search text full of quotes, backslashes and script text, hands it to the store exactly as given", async () => {
    const hostile = '" & (do shell script "id") & "\\\\ `id` $(id)';

    const result = await searchNotes({ text: hostile });

    expect(result.isError ?? false).toBe(false);
    expect(noteStore.searched[0]?.searchText).toBe(hostile);
  });

  // A locked note's text can't be read, so it can't be searched; saying it is locked is what
  // keeps its silence from reading as "this note says nothing".
  it("given a locked note whose title mentions the text, finds it and says it is locked", async () => {
    noteStore.holds(aNote("note-pins", "Fridge safe code", "4471", { isLocked: true }));

    const byTitle = await searchNotes({ text: "fridge" });
    const byText = await searchNotes({ text: "4471" });

    expect(byTitle.structuredContent).toMatchObject({
      notes: [{ identifier: "note-pins", isLocked: true }],
    });
    expect(byText.structuredContent).toMatchObject({ notes: [] });
  });

  // neektza 5d0e84a: an answer cut short with no way to ask for the rest hid the note wanted.
  it("given more notes than the limit, reports the most recent of them, says how many there are in all, that the answer is truncated and where the next page starts", async () => {
    const first = await searchNotes({ text: "fridge", limit: 2 });
    const next = await searchNotes({ text: "fridge", limit: 2, offset: 2 });

    expect(first.structuredContent).toMatchObject({
      notes: [{ identifier: "note-fridge" }, { identifier: "note-diary" }],
      coverage: { notesFound: 3, truncated: true, nextOffset: 2 },
    });
    expect(next.structuredContent).toMatchObject({
      notes: [{ identifier: "note-boiler" }],
      coverage: { truncated: false },
    });
  });

  it("given empty search text, refuses rather than reporting every note or none", async () => {
    const result = await searchNotes({ text: "  " });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
    expect(noteStore.searched).toStrictEqual([]);
  });

  it("given Notes may not be controlled, refuses with a permission failure rather than finding nothing", async () => {
    noteStore.refuses(notesRefused);

    const result = await searchNotes({ text: "fridge" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "notes_permission_missing" },
    });
  });
});
