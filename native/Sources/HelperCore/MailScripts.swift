/// Mail's scripts. Each is a constant: what a request supplies reaches `run` as JSON text beside
/// it and is only ever parsed as JSON, so an identifier made of script source is an identifier
/// no mail account has, and nothing more.
public enum MailScripts {
  public static let all = [mailAccounts, mailboxes, emails, email, emailMessageIds, emailBodies]

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

      // Mail addresses a mailbox by its account and its full name, and writes exactly that when
      // asked to show a reference. A mailbox's own name is only its last part.
      const written = new RegExp(
        '^Application\\("Mail"\\)\\.accounts\\.byId\\((".*?")\\)' +
          '\\.mailboxes\\.byName\\((".*")\\)$',
        "s"
      );
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
          if (address === null) {
            throw new Error("Mail wrote a mailbox reference in a form not known");
          }
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

  /// One mailbox's emails, in a range or all of them, newest first. Every column is one read of
  /// the whole mailbox, at about a fifth of a millisecond an email: a thousand emails measured
  /// 1.4 seconds for all six, and `whose`, the other way to ask, costs 17 milliseconds a
  /// matching email (#7).
  public static let emails = StaticScript(
    name: "emails",
    source: #"""
    function run(argumentsJSON) {
      const asked = JSON.parse(argumentsJSON);
      const mail = Application("Mail");
      if (mail.accounts.id().indexOf(asked.mailAccount) < 0) {
        return JSON.stringify({ mailAccountUnknown: true });
      }

      const mailbox = mail.accounts.byId(asked.mailAccount).mailboxes.byName(asked.mailbox);
      const messages = mailbox.messages;

      // Every column is one read of the whole mailbox, which costs about a fifth of a
      // millisecond an email and cannot be stopped once asked for. The first column says what
      // the rest will cost, so a mailbox too large to finish in time is refused here, while
      // Mail is still answering, rather than given up on halfway. The six reads measured
      // between 5.2 and 6.9 times the first, on mailboxes of one and five thousand emails.
      // Nothing is asked of the mailbox before this: even counting its emails took 6.6
      // seconds on one of 76,188 (#7).
      const started = Date.now();
      let identifiers;
      try {
        identifiers = messages.id();
      } catch (error) {
        if (error.errorNumber !== -1728) throw error;
        // Either there is no such mailbox, or it is one Mail keeps no emails in, such as
        // the Notes mailbox of an IMAP account, which counts none and fails any read of
        // them. Its name tells.
        try {
          mailbox.name();
        } catch (missing) {
          if (missing.errorNumber === -1728) return JSON.stringify({ mailboxUnknown: true });
          throw missing;
        }
        return JSON.stringify({ emails: [], truncated: false, undated: 0 });
      }
      const firstColumn = Date.now() - started;
      if (firstColumn * 7 > asked.withinMilliseconds) {
        return JSON.stringify({ mailboxTooLarge: { emails: identifiers.length } });
      }

      const received = messages.dateReceived();
      const subjects = messages.subject();
      const senders = messages.sender();
      const read = messages.readStatus();

      // Each column is its own read, so an email arriving in between would pair one email's
      // subject with another's sender. The identifiers are read again, and an answer that
      // moved is refused.
      const identifiersAfter = messages.id();
      const columns = [received, subjects, senders, read, identifiersAfter];
      if (
        columns.some((column) => column.length !== identifiers.length) ||
        identifiersAfter.some((identifier, index) => identifier !== identifiers[index])
      ) {
        throw new Error("the mailbox changed while it was being read");
      }

      const from = asked.from === null ? -Infinity : asked.from;
      const to = asked.to === null ? Infinity : asked.to;
      // An email Mail gives no received date cannot be placed in a range or among the latest,
      // and making a date up for it is worse (findings MAIL-49), so it is counted.
      const inRange = [];
      let undated = 0;
      identifiers.forEach((identifier, index) => {
        const at = received[index] ? received[index].getTime() : null;
        if (at === null) undated += 1;
        if (at === null || at < from || at >= to) return;
        inRange.push({
          storeIdentifier: identifier,
          receivedAt: at,
          subject: subjects[index] || "",
          sender: senders[index] || "",
          isRead: read[index] === true,
        });
      });

      // Newest first by when each was received, whatever order the mailbox keeps.
      inRange.sort((left, right) => right.receivedAt - left.receivedAt);
      return JSON.stringify({
        emails: inRange.slice(0, asked.most),
        truncated: inRange.length > asked.most,
        undated: undated,
      });
    }
    """#)

  /// A Message-ID costs ten times what any other column does, so it is read email by email, for
  /// the few that make an answer: about 20 milliseconds each.
  public static let emailMessageIds = StaticScript(
    name: "email_message_ids",
    source: #"""
    function run(argumentsJSON) {
      const asked = JSON.parse(argumentsJSON);
      const mail = Application("Mail");
      if (mail.accounts.id().indexOf(asked.mailAccount) < 0) {
        return JSON.stringify({ mailAccountUnknown: true });
      }

      // Asked about a mailbox that is not there, Mail fails each email the way it fails one
      // that has gone, which would make a whole answer vanish without a word. So the mailbox
      // is asked first.
      const mailbox = mail.accounts.byId(asked.mailAccount).mailboxes.byName(asked.mailbox);
      try {
        mailbox.name();
      } catch (missing) {
        if (missing.errorNumber === -1728) return JSON.stringify({ mailboxUnknown: true });
        throw missing;
      }
      const messages = mailbox.messages;
      const messageIds = {};
      asked.emails.forEach((storeIdentifier) => {
        try {
          messageIds[storeIdentifier] = messages.byId(storeIdentifier).messageId();
        } catch (error) {
          // An email that has gone since it was listed has no Message-ID to read, and is
          // left out.
          if (error.errorNumber !== -1728 && error.errorNumber !== -1719) throw error;
        }
      });
      return JSON.stringify({ messageIds: messageIds });
    }
    """#)

  /// Bodies, read only when a caller asked for bodies to be searched (#24): between a fifth of a
  /// second and a second each, which is upstream #19's hang when it is done for every email.
  public static let emailBodies = StaticScript(
    name: "email_bodies",
    source: #"""
    function run(argumentsJSON) {
      const asked = JSON.parse(argumentsJSON);
      const started = Date.now();
      const mail = Application("Mail");
      if (mail.accounts.id().indexOf(asked.mailAccount) < 0) {
        return JSON.stringify({ mailAccountUnknown: true });
      }

      // Asked about a mailbox that is not there, Mail fails each email the way it fails one
      // that has gone, which would make a whole answer vanish without a word. So the mailbox
      // is asked first.
      const mailbox = mail.accounts.byId(asked.mailAccount).mailboxes.byName(asked.mailbox);
      try {
        mailbox.name();
      } catch (missing) {
        if (missing.errorNumber === -1728) return JSON.stringify({ mailboxUnknown: true });
        throw missing;
      }
      const messages = mailbox.messages;
      const bodies = {};
      let slowest = 0;
      for (const storeIdentifier of asked.emails) {
        // A body takes up to a second to read, and a read cannot be stopped once asked for.
        // So the script stops itself while there is still room for one more of the slowest
        // so far, and whatever it did not reach is absent from the answer: not read, which
        // is not "no match".
        const elapsed = Date.now() - started;
        if (elapsed + Math.max(slowest, 1500) > asked.withinMilliseconds) break;

        const before = Date.now();
        try {
          const body = messages.byId(storeIdentifier).content();
          bodies[storeIdentifier] = (body || "").slice(0, asked.longestBody);
        } catch (error) {
          if (error.errorNumber !== -1728 && error.errorNumber !== -1719) throw error;
        }
        slowest = Math.max(slowest, Date.now() - before);
      }
      return JSON.stringify({ bodies: bodies });
    }
    """#)

  /// One email in full, found under its store identifier when its Message-ID is the one wanted,
  /// which takes ten milliseconds in a mailbox of any size, and otherwise by scanning the mailbox
  /// for the Message-ID, which took 7.5 seconds in one of five thousand emails.
  public static let email = StaticScript(
    name: "email",
    source: #"""
    function run(argumentsJSON) {
      const asked = JSON.parse(argumentsJSON);
      const began = Date.now();
      const mail = Application("Mail");
      const accountIdentifiers = mail.accounts.id();
      const accountIndex = accountIdentifiers.indexOf(asked.mailAccount);
      if (accountIndex < 0) return JSON.stringify({ mailAccountUnknown: true });

      const account = mail.accounts.byId(asked.mailAccount);
      const mailbox = account.mailboxes.byName(asked.mailbox);
      try {
        mailbox.name();
      } catch (missing) {
        if (missing.errorNumber === -1728) return JSON.stringify({ mailboxUnknown: true });
        throw missing;
      }
      const messages = mailbox.messages;
      const gone = (error) => error.errorNumber === -1728 || error.errorNumber === -1719;

      // The store identifier is where to look first: ten milliseconds in a mailbox of any
      // size. It is only a hint, because nothing says it outlives a restart of Mail or a
      // move, so what it finds is the email only when its Message-ID is the one asked for.
      let found = null;
      try {
        const hinted = messages.byId(asked.storeIdentifier);
        if (hinted.messageId() === asked.messageId) found = hinted;
      } catch (error) {
        if (!gone(error)) throw error;
      }

      // Otherwise the mailbox is looked through for the Message-ID, which costs a millisecond
      // and a half an email and cannot be stopped once asked for: 7.5 seconds in a mailbox of
      // five thousand. The identifiers column is read first to see what that would cost: the
      // look measured between 6.5 and 11.8 times as long as the column, so twelve times is
      // taken, on top of the time already gone and what reading the email afterwards needs. A
      // mailbox where that would not fit is refused while Mail is still answering, with the
      // way out: a fresh reference.
      if (found === null) {
        const columnBegan = Date.now();
        const identifiers = messages.id();
        const column = Date.now() - columnBegan;
        const neededToReadTheEmail = 2000;
        const wouldTake = Date.now() - began + column * 12 + neededToReadTheEmail;
        if (wouldTake > asked.withinMilliseconds) {
          return JSON.stringify({ referenceStale: { emails: identifiers.length } });
        }
        // Copies of one email in one mailbox share its Message-ID, and any of them is that
        // email.
        const matching = messages.whose({ messageId: asked.messageId }).id();
        if (matching.length === 0) return JSON.stringify({ email: null });
        found = messages.byId(matching[0]);
      }

      const correspondents = (recipients) =>
        recipients.map((recipient) => ({
          name: recipient.name() || null,
          address: recipient.address() || "",
        }));
      // An attachment Mail has not downloaded may not say its type or its size. What it does
      // not say is left out, never filled in.
      const saying = (read) => {
        try {
          const said = read();
          return said === undefined ? null : said;
        } catch (error) {
          return null;
        }
      };

      // An email with no received date is never listed, so a reference to one was made by
      // hand.
      const received = found.dateReceived();
      if (!received) throw new Error("the email has no received date");
      const sent = found.dateSent();

      // A character outside the basic plane is two units long, and the cut never falls inside
      // one: half a character is not text, and an answer holding it cannot be read as JSON.
      const body = found.content() || "";
      let text = body.slice(0, asked.longestBody);
      const last = text.charCodeAt(text.length - 1);
      if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1);
      return JSON.stringify({
        email: {
          storeIdentifier: found.id(),
          mailAccountName: mail.accounts.name()[accountIndex],
          subject: found.subject() || "",
          sender: found.sender() || "",
          to: correspondents(found.toRecipients()),
          cc: correspondents(found.ccRecipients()),
          bcc: correspondents(found.bccRecipients()),
          receivedAt: received.getTime(),
          sentAt: sent ? sent.getTime() : null,
          isRead: found.readStatus() === true,
          body: text,
          bodyCharacters: body.length,
          attachments: found.mailAttachments().map((attachment) => ({
            name: saying(() => attachment.name()),
            contentType: saying(() => attachment.mimeType()),
            size: saying(() => attachment.fileSize()),
          })),
        },
      });
    }
    """#)
}
