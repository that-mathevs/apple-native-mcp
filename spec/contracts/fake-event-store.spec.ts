import type { Occurrence } from "../../src/domain/calendar/event.js";
import { FakeEventStore } from "../support/fake-event-store.js";
import { anEventStore, anEventStoreThatCanBeLoaded } from "./event-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the
// same contract here. The helper-backed store answers it on a Mac.
const fake = (): {
  eventStore: FakeEventStore;
  holding: (...occurrences: readonly Occurrence[]) => Promise<void>;
} => {
  const eventStore = new FakeEventStore();
  return {
    eventStore,
    holding: (...occurrences) => {
      eventStore.holds(...occurrences);
      return Promise.resolve();
    },
  };
};

anEventStore({
  name: "the fake event store",
  build: () => Promise.resolve(fake()),
});

anEventStoreThatCanBeLoaded({
  name: "the fake event store",
  build: () => Promise.resolve(fake()),
});
