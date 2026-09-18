/// The scripts Notes is reached by. Each is a constant, takes its arguments as one JSON text and
/// answers with one JSON text. Nothing in them is assembled at run time, and a script shares no
/// code with another: each has to stand alone to be a constant, so the walk over note folders is
/// written out in each script that needs it.
///
/// What #6 measured on Notes 4.13 shapes them. A note's `container` is broken and its bulk form
/// answers with nulls, so a note's folder is found by walking folders. A column of a whole note
/// folder is read in one Apple Event, which is fast, and nothing ties one column to the next but
/// position: so the identifiers are read before and after, and an answer whose columns may have
/// slipped against each other is refused rather than pairing one note's title with another's text.
public enum NotesScripts {
  public static let all = [noteFolders, notesInNoteFolder, note]

  public static let noteFolders = StaticScript(
    name: "note_folders",
    source: """
      function run(argumentsJson) {
        const app = Application("Notes");
        const found = [];
        const seen = new Set();
        const walk = (folders, account) => {
          for (const folder of folders()) {
            const identifier = folder.id();
            if (seen.has(identifier)) continue;
            seen.add(identifier);
            found.push({ identifier: identifier, name: folder.name(), account: account });
            walk(folder.folders, account);
          }
        };
        for (const account of app.accounts()) {
          walk(account.folders, { identifier: account.id(), name: account.name() });
        }
        return JSON.stringify({ noteFolders: found });
      }
      """)

  public static let notesInNoteFolder = StaticScript(
    name: "notes_in_note_folder",
    source: """
      function run(argumentsJson) {
        const wanted = JSON.parse(argumentsJson).noteFolder;
        const app = Application("Notes");
        const notes = app.folders.byId(wanted).notes;

        const identifiers = notes.id();
        const titles = notes.name();
        const modified = notes.modificationDate();
        const locked = notes.passwordProtected();

        // One Apple Event for every text is fast, and fails outright on a large note folder
        // (-1741) or one holding a locked note. Then each text is read on its own, and one that
        // will not come back is said to be unread rather than passed off as empty.
        let texts = null;
        try { texts = notes.plaintext(); } catch (tooMuchAtOnce) { texts = null; }
        const textOf = (index) => {
          if (locked[index] === true) return { textState: "locked", text: null };
          if (texts !== null) return { textState: "read", text: texts[index] };
          try {
            return { textState: "read", text: app.notes.byId(identifiers[index]).plaintext() };
          } catch (unreadable) {
            return { textState: "unread", text: null };
          }
        };

        const after = notes.id();
        const columns = [titles, modified, locked, after].concat(texts === null ? [] : [texts]);
        const slipped =
          columns.some((column) => column.length !== identifiers.length) ||
          after.some((identifier, index) => identifier !== identifiers[index]);
        if (slipped) throw new Error("The note folder changed while it was being read.");

        return JSON.stringify({
          notes: identifiers.map((identifier, index) => {
            if (typeof titles[index] !== "string" || !(modified[index] instanceof Date)) {
              throw new Error("Notes did not report a title and a date for every note.");
            }
            const text = textOf(index);
            return {
              identifier: identifier,
              title: titles[index],
              modified: modified[index].toISOString(),
              textState: text.textState,
              text: text.text,
            };
          }),
        });
      }
      """)

  public static let note = StaticScript(
    name: "note",
    source: """
      function run(argumentsJson) {
        const wanted = JSON.parse(argumentsJson);
        const app = Application("Notes");
        const note = app.notes.byId(wanted.identifier);
        try { note.id(); } catch (missing) {
          if (missing.errorNumber === -1728) return JSON.stringify({ note: null });
          throw missing;
        }

        // Where the note is kept is settled before anything of it is read, so the text of a
        // note kept outside the note folders asked about never leaves Notes.
        const keptIn = (folders, account) => {
          for (const folder of folders()) {
            if (folder.notes.id().includes(wanted.identifier)) {
              return { identifier: folder.id(), name: folder.name(), account: account };
            }
            const deeper = keptIn(folder.folders, account);
            if (deeper !== null) return deeper;
          }
          return null;
        };
        let noteFolder = null;
        for (const account of app.accounts()) {
          noteFolder = keptIn(account.folders, { identifier: account.id(), name: account.name() });
          if (noteFolder !== null) break;
        }
        if (noteFolder === null || !wanted.noteFolders.includes(noteFolder.identifier)) {
          return JSON.stringify({ note: null });
        }

        const modified = note.modificationDate();
        if (!(modified instanceof Date)) throw new Error("Notes did not report when it changed.");
        const isLocked = note.passwordProtected() === true;
        return JSON.stringify({
          note: {
            note: {
              identifier: wanted.identifier,
              title: note.name(),
              modified: modified.toISOString(),
              textState: isLocked ? "locked" : "read",
              text: isLocked ? null : note.plaintext(),
            },
            noteFolder: noteFolder,
            attachments: note.attachments.length,
          },
        });
      }
      """)
}
