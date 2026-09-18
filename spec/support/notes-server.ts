import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { settingsFrom } from "../../src/domain/settings.js";
import type { Note, NoteFolder } from "../../src/domain/notes/note.js";
import { aServer } from "./a-server.js";
import { connectedTo } from "./connected-client.js";
import type { FakeNoteStore } from "./fake-note-store.js";

const iCloud = { identifier: "account-icloud", name: "iCloud" } as const;
const onMyMac = { identifier: "account-local", name: "On My Mac" } as const;

/** Two note folders called Notes, one in each notes account, and a folder worth keeping back. */
export const iCloudNotes: NoteFolder = { identifier: "folder-1", name: "Notes", account: iCloud };
export const localNotes: NoteFolder = { identifier: "folder-2", name: "Notes", account: onMyMac };
export const journal: NoteFolder = { identifier: "folder-3", name: "Journal", account: iCloud };

export const aNote = (
  identifier: string,
  title: string,
  text: string,
  details: Partial<Note> = {},
): Note => ({
  identifier,
  title,
  text,
  modified: new Date("2026-09-10T09:00:00Z"),
  isLocked: false,
  textUnread: false,
  attachments: 0,
  noteFolder: iCloudNotes,
  ...details,
});

/** A note whose text would not come back: too big to carry, or still downloading. */
export const aNoteLeftUnread = (identifier: string, title: string): Note => ({
  identifier,
  title,
  modified: new Date("2026-09-10T09:00:00Z"),
  isLocked: false,
  textUnread: true,
  attachments: 0,
  noteFolder: iCloudNotes,
});

/** An agent's client of the real server, with this note store behind it and these settings. */
export const aClientOfNotes = async (
  noteStore: FakeNoteStore,
  configuration: Record<string, string> = {},
): Promise<Client> =>
  await connectedTo(aServer({ noteStore, settings: settingsFrom(configuration) }));
