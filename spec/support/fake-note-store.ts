import type { NotesMentioning, NoteStore } from "../../src/application/notes/note-store.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";
import type { Note, NoteFolder } from "../../src/domain/notes/note.js";

/** What the helper answers when the user has not let it script Notes, word for word. */
export const notesRefused: NamedFailure = {
  code: "notes_permission_missing",
  sentence:
    "apple-native-mcp cannot read your notes until it is allowed to control Notes, in System " +
    "Settings > Privacy & Security > Automation > apple-native-mcp > Notes.",
  evidence: "refused",
};

/**
 * A note store held in memory.
 *
 * It answers the same contract as the helper-backed one, so the scenarios that use it are
 * worth trusting only for as long as it passes that contract (spec/contracts).
 */
export class FakeNoteStore implements NoteStore {
  /** Every search the store was asked for, so a scenario can say which folders were read. */
  readonly searched: { searchText: string; noteFolders: readonly string[] }[] = [];

  #noteFolders: readonly NoteFolder[] = [];
  #notes: readonly Note[] = [];
  #unreadable: readonly string[] = [];
  #textUnread: readonly string[] = [];
  #failure: NamedFailure | undefined;

  holdsNoteFolders(...noteFolders: readonly NoteFolder[]): void {
    this.#noteFolders = noteFolders;
  }

  holds(...notes: readonly Note[]): void {
    this.#notes = notes;
  }

  /** A note folder that won't answer: an account that is offline or still syncing. */
  cannotRead(...noteFolderIdentifiers: readonly string[]): void {
    this.#unreadable = noteFolderIdentifiers;
  }

  /** Notes whose text will not come back: too big to carry, or still downloading. */
  cannotReadTheTextOf(...noteIdentifiers: readonly string[]): void {
    this.#textUnread = noteIdentifiers;
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  noteFolders(): Promise<Outcome<readonly NoteFolder[]>> {
    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#noteFolders));
  }

  notesMentioning(
    searchText: string,
    noteFolders: readonly NoteFolder[],
  ): Promise<Outcome<NotesMentioning>> {
    const asked = noteFolders.map(({ identifier }) => identifier);
    this.searched.push({ searchText, noteFolders: asked });

    if (this.#failure) return Promise.resolve(failed(this.#failure));

    // Upper-cased on both sides, as the helper folds case, so the two agree on every letter.
    const sought = searchText.toUpperCase();
    const read = asked.filter((identifier) => !this.#unreadable.includes(identifier));
    const within = this.#notes.filter(({ noteFolder }) => read.includes(noteFolder.identifier));
    const readable = (note: Note): string =>
      note.isLocked || this.#textUnread.includes(note.identifier) ? "" : (note.text ?? "");

    return Promise.resolve(
      succeeded({
        notes: within
          .filter((note) =>
            [note.title, readable(note)].some((field) => field.toUpperCase().includes(sought)),
          )
          .map(({ identifier, title, modified, isLocked, noteFolder }) => ({
            identifier,
            title,
            modified,
            isLocked,
            noteFolder,
          })),
        unreadNoteFolders: asked.filter((identifier) => this.#unreadable.includes(identifier)),
        notesUnread: within.filter(({ identifier }) => this.#textUnread.includes(identifier))
          .length,
      }),
    );
  }

  note(identifier: string, noteFolders: readonly NoteFolder[]): Promise<Outcome<Note | undefined>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const allowed = noteFolders.map((noteFolder) => noteFolder.identifier);

    return Promise.resolve(
      succeeded(
        this.#notes.find(
          (note) => note.identifier === identifier && allowed.includes(note.noteFolder.identifier),
        ),
      ),
    );
  }
}
