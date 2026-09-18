import { aContact, FakeContactStore } from "../support/fake-contact-store.js";
import { aContactStore } from "./contact-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the same
// contract here. The helper-backed store answers it on a Mac.
aContactStore({
  name: "the fake contact store",
  build: () => {
    const contactStore = new FakeContactStore();
    contactStore.holds(
      aContact("contact-1", "Sam", "Okafor", {
        phoneNumbers: [{ label: "mobile", written: "+44 7700 900123" }],
        emailAddresses: [{ label: "work", address: "sam@example.test" }],
        urls: [{ label: "home page", url: "https://example.test" }],
      }),
    );
    return Promise.resolve({ contactStore });
  },
});
