import { FakeMailStore } from "../support/fake-mail-store.js";
import { aMailStore } from "./mail-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the same
// contract here, loaded the way a Mac's Mail often is: two accounts that both have an inbox, and
// a mailbox inside another. The helper-backed store answers it on a Mac.
const personal = {
  identifier: "account-personal",
  name: "Personal",
  emailAddresses: ["ada@example.test"],
} as const;
const work = { identifier: "account-work", name: "Work", emailAddresses: [] } as const;

aMailStore({
  name: "the fake mail store",
  build: () => {
    const mailStore = new FakeMailStore();
    mailStore.holdsMailAccounts(personal, work);
    mailStore.holdsMailboxes(
      personal,
      { path: ["INBOX"], role: "inbox" },
      { path: ["Clients"] },
      { path: ["Clients", "Invoices"] },
    );
    mailStore.holdsMailboxes(
      work,
      { path: ["INBOX"], role: "inbox" },
      { path: ["Sent"], role: "sent" },
    );
    return Promise.resolve({ mailStore });
  },
});
