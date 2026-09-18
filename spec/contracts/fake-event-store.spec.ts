import { FakeEventStore } from "../support/fake-event-store.js";
import { anEventStore } from "./event-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the
// same contract here. The helper-backed store answers it on a Mac.
anEventStore({
  name: "the fake event store",
  build: () => {
    const eventStore = new FakeEventStore();

    return Promise.resolve({
      eventStore,
      holding: (...occurrences) => {
        eventStore.holds(...occurrences);
        return Promise.resolve();
      },
    });
  },
});
