import { describe, expect, it } from "vitest";

import type { NoteStore } from "../../src/application/notes/note-store.js";

/**
 * What every note store promises, whichever way it reaches Notes: against the fake everywhere,
 * and against the real store on a Mac that lets the helper control Notes.
 */
export type NoteStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly noteStore: NoteStore }>;
};

const aNoteFolder = {
  identifier: expect.any(String) as string,
  name: expect.any(String) as string,
  account: { identifier: expect.any(String) as string, name: expect.any(String) as string },
};

export const aNoteStore = ({ name, build }: NoteStoreUnderTest): void => {
  describe(`${name}, as a note store`, () => {
    it("names every note folder with its identifier and the notes account it belongs to", async () => {
      const { noteStore } = await build();

      const read = await noteStore.noteFolders();

      expect(read.ok).toBe(true);
      for (const noteFolder of read.ok ? read.value : []) {
        expect(noteFolder).toStrictEqual(aNoteFolder);
      }
    });

    // faces-sh 94149a2: an index that carried every note's text was 2.3 MB.
    it("given a search, answers with notes that carry where they are kept and never their text", async () => {
      const { noteStore } = await build();
      const folders = await noteStore.noteFolders();
      const everywhere = folders.ok ? folders.value : [];

      const found = await noteStore.notesMentioning("e", everywhere);

      expect(found).toMatchObject({
        ok: true,
        value: {
          unreadNoteFolders: expect.any(Array) as unknown[],
          notesUnread: expect.any(Number) as number,
        },
      });
      for (const note of found.ok ? found.value.notes : []) {
        expect(note).toStrictEqual({
          identifier: expect.any(String) as string,
          title: expect.any(String) as string,
          modified: expect.any(Date) as Date,
          isLocked: expect.any(Boolean) as boolean,
          noteFolder: aNoteFolder,
        });
      }
    });

    it("given an identifier no note has, answers with nothing rather than a failure", async () => {
      const { noteStore } = await build();

      const folders = await noteStore.noteFolders();

      const read = await noteStore.note(
        "no-note-has-this-identifier",
        folders.ok ? folders.value : [],
      );

      expect(read).toStrictEqual({
        ok: true,
        value: undefined,
      });
    });

    it("given a note it found, reads that note in full by its identifier", async () => {
      const { noteStore } = await build();
      const folders = await noteStore.noteFolders();
      const everywhere = folders.ok ? folders.value : [];
      const found = await noteStore.notesMentioning("e", everywhere);
      const first = found.ok ? found.value.notes.find(({ isLocked }) => !isLocked) : undefined;

      if (first === undefined) return;

      const read = await noteStore.note(first.identifier, everywhere);

      expect(read).toMatchObject({
        ok: true,
        value: {
          identifier: first.identifier,
          title: first.title,
          textUnread: expect.any(Boolean) as boolean,
          attachments: expect.any(Number) as number,
        },
      });
    });

    // Story 50: the text of a note kept where the agent may not look is never read at all.
    it("given a note kept outside the note folders it may be read from, answers with nothing", async () => {
      const { noteStore } = await build();
      const folders = await noteStore.noteFolders();
      const everywhere = folders.ok ? folders.value : [];
      const found = await noteStore.notesMentioning("e", everywhere);
      const first = found.ok ? found.value.notes[0] : undefined;

      if (first === undefined) return;

      expect(await noteStore.note(first.identifier, [])).toStrictEqual({
        ok: true,
        value: undefined,
      });
    });
  });
};
