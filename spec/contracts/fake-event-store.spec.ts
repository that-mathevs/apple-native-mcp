import type { Occurrence } from "../../src/domain/calendar/event.js";
import { FakeEventStore } from "../support/fake-event-store.js";
import {
  anEventStore,
  anEventStoreThatCanBeLoaded,
  anEventStoreThatCreatesEvents,
  anEventStoreThatListsCalendars,
} from "./event-store.contract.js";
import { iCloud } from "../support/calendar-accounts.js";

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

anEventStoreThatListsCalendars({
  name: "the fake event store",
  build: () => {
    const { eventStore } = fake();
    eventStore.hasCalendars({
      identifier: "cal-1",
      title: "Work",
      account: iCloud,
      acceptsNewEvents: true,
    });
    return Promise.resolve({ eventStore });
  },
});

anEventStoreThatCanBeLoaded({
  name: "the fake event store",
  build: () => Promise.resolve(fake()),
});

anEventStoreThatCreatesEvents({
  name: "the fake event store",
  build: () => {
    const { eventStore } = fake();
    eventStore.hasCalendars({
      identifier: "cal-1",
      title: "Work",
      account: iCloud,
      acceptsNewEvents: true,
    });
    return Promise.resolve({ eventStore, calendar: "cal-1", timeZone: "America/New_York" });
  },
});
