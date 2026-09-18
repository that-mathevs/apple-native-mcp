import { describe, expect, it } from "vitest";

import { samePath } from "./mailbox.js";

describe("a mailbox path", () => {
  // morquis 8a9b013: Mail hands a name over decomposed, a client sends it composed, and a
  // byte-for-byte comparison says the mailbox is not there.
  it("given the same name in decomposed and composed Unicode, treats them as one path", () => {
    expect(samePath(["Résumés"], ["Résumés"])).toBe(true);
  });

  it("given the same names in a different order, or fewer of them, is a different path", () => {
    expect(samePath(["Clients", "Invoices"], ["Invoices", "Clients"])).toBe(false);
    expect(samePath(["Clients", "Invoices"], ["Clients"])).toBe(false);
  });

  it("is case-sensitive, as a mail server's mailbox names are", () => {
    expect(samePath(["Receipts"], ["receipts"])).toBe(false);
  });
});
