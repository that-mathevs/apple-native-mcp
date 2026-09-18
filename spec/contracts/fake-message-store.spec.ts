import type { Chat, Message } from "../../src/domain/messages/chat.js";
import { FakeMessageStore } from "../support/fake-message-store.js";
import { aMessageStore, aMessageStoreThatCanBeLoaded } from "./message-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the same
// contract here. The helper-backed store answers it on a Mac.
const fake = (): {
  messageStore: FakeMessageStore;
  holding: (chats: readonly Chat[], messages: readonly Message[]) => Promise<void>;
} => {
  const messageStore = new FakeMessageStore();
  return {
    messageStore,
    holding: (chats, messages) => {
      messageStore.holdsChats(...chats);
      messageStore.holdsMessages(...messages);
      return Promise.resolve();
    },
  };
};

aMessageStore({ name: "the fake message store", build: () => Promise.resolve(fake()) });

aMessageStoreThatCanBeLoaded({
  name: "the fake message store",
  build: () => Promise.resolve(fake()),
});
