import Testing

@testable import HelperCore

// Mail addresses a mailbox by one full name, its path joined with "/", and says separately what
// the mailbox's own name is and which mailboxes it sits inside. A path is read from all three.
@Suite("reading a mailbox's path from how Mail addresses it")
struct ReadingAMailboxPathSpec {
  @Test("given a mailbox at the top of its account, its path is its own name")
  func readsATopLevelMailbox() {
    #expect(mailboxPath(fullName: "INBOX", name: "INBOX", containers: []) == ["INBOX"])
  }

  @Test("given a mailbox inside another, its path is every name from the outermost in")
  func readsANestedMailbox() {
    #expect(
      mailboxPath(
        fullName: "Clients/Hartley/Invoices", name: "Invoices", containers: ["Hartley", "Clients"])
        == ["Clients", "Hartley", "Invoices"])
  }

  // morquis 8a9b013 split the full name on "/" and admits that a name containing one breaks it
  // (findings MAIL-C14). Mail says what each name is, so nothing has to be guessed.
  @Test("given names that contain a slash, keeps each as one name")
  func keepsASlashInsideAName() {
    #expect(
      mailboxPath(
        fullName: "Clients A/B/Invoices 2026/27", name: "Invoices 2026/27",
        containers: ["Clients A/B"])
        == ["Clients A/B", "Invoices 2026/27"])
  }

  // Measured on a Mac with seven accounts: 21 mailboxes in three of them sit under a server
  // folder that holds no mail, which Mail has no mailbox for. Leaving it out of the path would
  // lose the only address Mail accepts for the mailbox.
  @Test("given a parent that Mail has no mailbox for, still includes it in the path")
  func includesAParentThatIsNoMailbox() {
    #expect(
      mailboxPath(fullName: "[Provider]/Sent Mail", name: "Sent Mail", containers: [])
        == ["[Provider]", "Sent Mail"])
  }

  @Test(
    "whatever Mail says about the names, the path joined with a slash is the full name Mail addresses the mailbox by",
    arguments: [
      ("INBOX", "INBOX", [String]()),
      ("Clients/Hartley/Invoices", "Invoices", ["Hartley", "Clients"]),
      ("Clients A/B/Invoices 2026/27", "Invoices 2026/27", ["Clients A/B"]),
      ("[Provider]/Work/Sent Mail", "Sent Mail", ["Work"]),
      ("Archive/2026", "Renamed since", ["Somewhere else"]),
    ])
  func alwaysJoinsBackToTheFullName(fullName: String, name: String, containers: [String]) {
    #expect(
      mailboxPath(fullName: fullName, name: name, containers: containers)
        .joined(separator: "/") == fullName)
  }
}
