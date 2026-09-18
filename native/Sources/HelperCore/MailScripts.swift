/// Mail's scripts. Each is a constant: what a request supplies reaches `run` as JSON text beside
/// it and is only ever parsed as JSON, so an identifier made of script source is an identifier
/// no mail account has, and nothing more.
public enum MailScripts {
  public static let all = [mailAccounts, mailboxes]

  /// Three reads, each of one property of every account at once: measured at 35 to 150 ms for
  /// seven accounts (#7), where asking account by account pays for each one.
  public static let mailAccounts = StaticScript(
    name: "mail_accounts",
    source: #"""
    function run(argumentsJSON) {
      const mail = Application("Mail");
      const identifiers = mail.accounts.id();
      const names = mail.accounts.name();
      const emailAddresses = mail.accounts.emailAddresses();
      // Each property is its own read of every account, so an account added or removed in between
      // would pair one account's name with another's addresses. The identifiers are read again at
      // the end, and an answer that moved is refused rather than returned.
      const identifiersAfter = mail.accounts.id();
      if (
        names.length !== identifiers.length ||
        emailAddresses.length !== identifiers.length ||
        JSON.stringify(identifiersAfter) !== JSON.stringify(identifiers)
      ) {
        throw new Error("the mail accounts changed while they were being read");
      }
      return JSON.stringify({
        mailAccounts: identifiers.map((identifier, index) => ({
          identifier: identifier,
          name: names[index],
          emailAddresses: emailAddresses[index] || [],
        })),
      });
    }
    """#)

  /// One mail account's mailboxes as Mail addresses them, with what is needed to read a path and
  /// a role from that and nothing decided here: about 300 ms an account on a Mac with seven.
  public static let mailboxes = StaticScript(
    name: "mailboxes",
    source: #"""
    function run(argumentsJSON) {
      const asked = JSON.parse(argumentsJSON);
      const mail = Application("Mail");
      if (mail.accounts.id().indexOf(asked.mailAccount) < 0) {
        return JSON.stringify({ mailAccountUnknown: true });
      }

      // Mail addresses a mailbox by its account and its full name, and writes exactly that when asked
      // to show a reference. A mailbox's own name is only its last part.
      const written = /^Application\("Mail"\)\.accounts\.byId\((".*?")\)\.mailboxes\.byName\((".*")\)$/s;
      const addressed = (mailbox) => {
        const match = written.exec(Automation.getDisplayString(mailbox));
        return match === null
          ? null
          : { mailAccount: JSON.parse(match[1]), fullName: JSON.parse(match[2]) };
      };

      const account = mail.accounts.byId(asked.mailAccount);
      const fullNamesNow = () =>
        account.mailboxes().map((mailbox) => {
          const address = addressed(mailbox);
          if (address === null) throw new Error("Mail wrote a mailbox reference in a form not known");
          return address.fullName;
        });
      const fullNames = fullNamesNow();
      const names = account.mailboxes.name();
      if (names.length !== fullNames.length) {
        throw new Error("the mailboxes changed while they were being read");
      }

      // The names of the mailboxes a mailbox sits inside, innermost first, read one level at a time
      // for every mailbox at once until no mailbox has a container left.
      const containers = fullNames.map(() => []);
      let level = account.mailboxes.container;
      for (let depth = 0; depth < 32; depth += 1) {
        const parents = level.name();
        if (parents.every((parent) => parent === null || parent === undefined)) break;
        parents.forEach((parent, index) => {
          if (parent !== null && parent !== undefined) containers[index].push(parent);
        });
        level = level.container;
      }

      // Every column above is its own read of every mailbox, so a mailbox added or removed in
      // between would pair one mailbox's name with another's address. The addresses are read again,
      // and an answer that moved is refused rather than returned.
      if (JSON.stringify(fullNamesNow()) !== JSON.stringify(fullNames)) {
        throw new Error("the mailboxes changed while they were being read");
      }

      const roles = {};
      const roleMailboxes = {
        inbox: "inbox",
        drafts: "draftsMailbox",
        sent: "sentMailbox",
        junk: "junkMailbox",
        trash: "trashMailbox",
      };
      Object.keys(roleMailboxes).forEach((role) => {
        roles[role] = mail[roleMailboxes[role]]
          .mailboxes()
          .map(addressed)
          .filter((address) => address !== null && address.mailAccount === asked.mailAccount)
          .map((address) => address.fullName);
      });

      return JSON.stringify({
        mailboxes: fullNames.map((fullName, index) => ({
          fullName: fullName,
          name: names[index],
          containers: containers[index],
        })),
        roles: roles,
      });
    }
    """#)
}
