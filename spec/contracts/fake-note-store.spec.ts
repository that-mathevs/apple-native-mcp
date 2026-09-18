import { FakeNoteStore } from "../support/fake-note-store.js";
import { aNote, iCloudNotes, localNotes } from "../support/notes-server.js";
import { aNoteStore } from "./note-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the same
// contract here. The helper-backed store answers it on a Mac.
aNoteStore({
  name: "the fake note store",
  build: () => {
    const noteStore = new FakeNoteStore();
    noteStore.holdsNoteFolders(iCloudNotes, localNotes);
    noteStore.holds(aNote("note-1", "Boiler", "The engineer's number is on the fridge."));
    return Promise.resolve({ noteStore });
  },
});
