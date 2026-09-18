import Foundation

/// A failure the helper reports instead of crashing or writing a bare error: a stable code, one
/// sentence saying what did not happen, and the outside evidence verbatim.
public struct NamedFailure: Error, Equatable, Sendable {
  public let code: FailureCode
  public let sentence: String
  public let evidence: String

  public init(code: FailureCode, sentence: String, evidence: String) {
    self.code = code
    self.sentence = sentence
    self.evidence = evidence
  }
}

/// The stable codes the helper reports. A code never changes once it has been published: the
/// server matches on it.
public enum FailureCode: String, Equatable, Sendable {
  /// The request named a protocol version this helper does not speak.
  case protocolVersionUnsupported = "protocol_version_unsupported"
  /// The line was not a request this helper could read.
  case requestMalformed = "request_malformed"
  /// The line named a request this helper does not answer.
  case requestUnknown = "request_unknown"
  /// macOS has not allowed the helper to read the calendar.
  case calendarPermissionMissing = "calendar_permission_missing"
  /// One calendar could not be read, so its events are missing from the answer.
  case calendarUnreadable = "calendar_unreadable"
  /// The range is longer than the event store will read in one go.
  case rangeTooLong = "range_too_long"
  /// No calendar has the identifier a new event was to be created in.
  case calendarNotFound = "calendar_not_found"
  /// The calendar a new event was to be created in does not accept new events.
  case calendarNotWritable = "calendar_not_writable"
  /// The event store would not save the event.
  case eventNotSaved = "event_not_saved"
  /// macOS has not allowed the helper to read the reminders.
  case remindersPermissionMissing = "reminders_permission_missing"
  /// A request named a reminder list the helper cannot find.
  case reminderListUnknown = "reminder_list_unknown"
  /// No reminder list answered within the time budget.
  case remindersTimedOut = "reminders_timed_out"
  /// The store would not save a new reminder.
  case reminderNotSaved = "reminder_not_saved"
  /// macOS has not allowed the helper to read the contacts.
  case contactsPermissionMissing = "contacts_permission_missing"
  /// The contact note was asked for, which macOS keeps for apps Apple has entitled.
  case contactNoteUnavailable = "contact_note_unavailable"
  /// The contact store would not be read.
  case contactsUnreadable = "contacts_unreadable"
  /// macOS has not allowed the helper to read the message store.
  case messageStorePermissionMissing = "message_store_permission_missing"
  /// This Mac has no message store.
  case messageStoreNotFound = "message_store_not_found"
  /// The message store is there but would not be read.
  case messageStoreUnreadable = "message_store_unreadable"
  /// A request named a chat the message store does not have.
  case chatUnknown = "chat_unknown"
  /// macOS has not allowed the helper to control Notes.
  case notesPermissionMissing = "notes_permission_missing"
  /// Notes would not be read at all.
  case notesUnreadable = "notes_unreadable"
  /// Notes did not answer within the time budget.
  case notesTimedOut = "notes_timed_out"
  /// macOS has not allowed the helper to read Mail.
  case mailPermissionMissing = "mail_permission_missing"
  /// Mail did not start, so nothing could be asked of it, its permission included.
  case mailDidNotStart = "mail_did_not_start"
  /// Mail did not answer within its time budget.
  case mailTimedOut = "mail_timed_out"
  /// Mail answered with a failure of its own.
  case mailUnreadable = "mail_unreadable"
  /// A request named a mail account the helper cannot find.
  case mailAccountUnknown = "mail_account_unknown"
  /// A request named a mailbox the mail account does not have.
  case mailboxUnknown = "mailbox_unknown"
  /// A mailbox holds too many emails to read within the time budget.
  case mailboxTooLarge = "mailbox_too_large"
  /// One message's archived text could not be read.
  case messageTextUnreadable = "message_text_unreadable"
}

extension NamedFailure {
  static func protocolVersionUnsupported(spoken: Int, asked: Int) -> NamedFailure {
    NamedFailure(
      code: .protocolVersionUnsupported,
      sentence:
        "This helper speaks protocol version \(spoken), so it cannot answer a request made at another version.",
      evidence: String(asked))
  }

  static func requestMalformed(line: String) -> NamedFailure {
    NamedFailure(
      code: .requestMalformed,
      sentence: "The helper could not read that line as a request.",
      evidence: line)
  }

  static func requestUnknown(name: String) -> NamedFailure {
    NamedFailure(
      code: .requestUnknown,
      sentence: "The helper does not answer a request by that name.",
      evidence: name)
  }

  // Upstream #65: a missing permission surfaced as a bare failure and left the user with nowhere
  // to go. The sentence names the setting and where it lives.
  static func calendarPermissionMissing(permission: Permission) -> NamedFailure {
    NamedFailure(
      code: .calendarPermissionMissing,
      sentence: permission == .undecided
        ? notAskedYet(for: "your calendar")
        : "apple-native-mcp cannot read your calendar until it is allowed to, in "
          + "\(calendarPermissionSetting).",
      evidence: permission.rawValue)
  }

  /// A tool never asks for a permission, and its setting only appears once macOS has asked, so a
  /// permission nobody has asked for points at setup rather than at a setting that is not there.
  private static func notAskedYet(for store: String) -> String {
    "apple-native-mcp has not been asked for \(store) yet. "
      + "Run `npx apple-native-mcp setup` to be asked."
  }

  static func calendarUnreadable(title: String, evidence: String) -> NamedFailure {
    NamedFailure(
      code: .calendarUnreadable,
      sentence: "The calendar \"\(title)\" could not be read, so its events are missing from this range.",
      evidence: evidence)
  }

  static func rangeTooLong(_ range: Range) -> NamedFailure {
    NamedFailure(
      code: .rangeTooLong,
      sentence: "A range can cover four years at most. Nothing was read: ask for a shorter one.",
      evidence: "\(Instant.written(range.start)) to \(Instant.written(range.end))")
  }

  static func remindersPermissionMissing(permission: Permission) -> NamedFailure {
    NamedFailure(
      code: .remindersPermissionMissing,
      sentence: permission == .undecided
        ? notAskedYet(for: "your reminders")
        : "apple-native-mcp cannot read your reminders until it is allowed to, in "
          + "\(remindersPermissionSetting).",
      evidence: permission.rawValue)
  }

  static func reminderListUnknown(identifier: String) -> NamedFailure {
    NamedFailure(
      code: .reminderListUnknown,
      sentence: "No reminder list has that identifier, so nothing was read.",
      evidence: identifier)
  }

  static func calendarNotFound(identifier: String) -> NamedFailure {
    NamedFailure(
      code: .calendarNotFound,
      sentence: "No calendar has that identifier. Nothing was created.",
      evidence: identifier)
  }

  static func calendarNotWritable(title: String) -> NamedFailure {
    NamedFailure(
      code: .calendarNotWritable,
      sentence: "That calendar does not accept new events. Nothing was created.",
      evidence: title)
  }

  static func eventNotSaved(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .eventNotSaved,
      sentence: "The event store would not save the event. Nothing was created.",
      evidence: evidence)
  }

  static func remindersTimedOut(seconds: TimeInterval, reminderLists: Int) -> NamedFailure {
    NamedFailure(
      code: .remindersTimedOut,
      sentence: "No reminder list answered within \(Int(seconds)) seconds, so nothing was read.",
      evidence: "\(reminderLists) reminder lists")
  }
  static func contactsPermissionMissing(permission: Permission) -> NamedFailure {
    NamedFailure(
      code: .contactsPermissionMissing,
      sentence: permission == .undecided
        ? notAskedYet(for: "your contacts")
        : "apple-native-mcp cannot read your contacts until it is allowed to, in "
          + "\(contactsPermissionSetting).",
      evidence: permission.rawValue)
  }

  static func contactsUnreadable(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .contactsUnreadable,
      sentence: "The contacts could not be read, so nobody was looked for. Nothing was found "
        + "or ruled out.",
      evidence: evidence)
  }

  static func mailPermissionMissing(permission: Permission) -> NamedFailure {
    NamedFailure(
      code: .mailPermissionMissing,
      sentence: permission == .undecided
        ? notAskedYet(for: "Mail")
        : "apple-native-mcp cannot read Mail until it is allowed to, in "
          + "\(mailPermissionSetting).",
      evidence: permission.rawValue)
  }

  // #7: a request Mail is still working on keeps it busy long after the caller gave up, so the
  // sentence says that asking again straight away will not help.
  static func mailTimedOut(seconds: Int) -> NamedFailure {
    NamedFailure(
      code: .mailTimedOut,
      sentence: "Mail did not answer within \(seconds) seconds, so nothing was read. "
        + "Mail can stay busy for minutes: ask again later.",
      evidence: "\(seconds) seconds")
  }

  static func mailDidNotStart(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .mailDidNotStart,
      sentence: "Mail did not start, so nothing was read. Open Mail, then ask again.",
      evidence: evidence)
  }

  static func mailAccountUnknown(identifier: String) -> NamedFailure {
    NamedFailure(
      code: .mailAccountUnknown,
      sentence: "No mail account has that identifier, so no mailbox was read.",
      evidence: identifier)
  }

  static func mailboxUnknown(path: [String]) -> NamedFailure {
    NamedFailure(
      code: .mailboxUnknown,
      sentence: "That mail account has no mailbox with that path, so no email was read.",
      evidence: path.joined(separator: "/"))
  }

  // A column of a mailbox is read whole and cannot be stopped once asked for, and a read given up
  // on leaves Mail busy for minutes (#7). So the refusal comes first, and says Mail is fine.
  static func mailboxTooLarge(emails: Int, seconds: Int) -> NamedFailure {
    NamedFailure(
      code: .mailboxTooLarge,
      sentence: "That mailbox holds \(emails) emails, too many to read within \(seconds) "
        + "seconds, so none was read and Mail was left alone. A shorter range would not help: a "
        + "mailbox is read whole whatever the range. Search it in Mail itself.",
      evidence: "\(emails) emails")
  }

  static func mailUnreadable(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .mailUnreadable,
      sentence: "Mail could not be read, so nothing was listed or ruled out.",
      evidence: evidence)
  }

  static let contactNoteUnavailable = NamedFailure(
    code: .contactNoteUnavailable,
    sentence: "A contact's note cannot be read: macOS keeps it for apps Apple has entitled. "
      + "Nothing was read.",
    evidence: "note")

  // Upstream #62 blamed one missing permission for every way the store could fail to open, and
  // upstream #66 turned all of them into no messages (MSG-C11). Each has its own failure.
  static func messageStorePermissionMissing(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .messageStorePermissionMissing,
      sentence: "apple-native-mcp cannot read your messages until it is allowed to, in "
        + "\(messageStorePermissionSetting).",
      evidence: evidence)
  }

  static func messageStoreNotFound(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .messageStoreNotFound,
      sentence: "This Mac has no message store, so there are no messages to read.",
      evidence: evidence)
  }

  static func messageStoreUnreadable(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .messageStoreUnreadable,
      sentence: "The message store is there but could not be read, so nothing was read.",
      evidence: evidence)
  }

  static func chatUnknown(identifier: String) -> NamedFailure {
    NamedFailure(
      code: .chatUnknown,
      sentence: "No chat has that identifier, so nothing was read.",
      evidence: identifier)
  }

  static func notesPermissionMissing(permission: Permission) -> NamedFailure {
    NamedFailure(
      code: .notesPermissionMissing,
      sentence: permission == .undecided
        ? notAskedYet(for: "control of Notes")
        : "apple-native-mcp cannot read your notes until it is allowed to control Notes, in "
          + "\(notesPermissionSetting).",
      evidence: permission.rawValue)
  }

  static func notesUnreadable(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .notesUnreadable,
      sentence: "Notes could not be read, so nothing was looked for. Nothing was found or "
        + "ruled out.",
      evidence: evidence)
  }

  static func notesTimedOut(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .notesTimedOut,
      sentence: "Notes did not answer within the time budget, so this was not read. Nothing was "
        + "found or ruled out.",
      evidence: evidence)
  }

  /// A failure of Notes, told apart by the error's number and never by its wording (X-54): a
  /// refused permission and a timeout each have a number of their own.
  static func notes(_ failure: NotesUnreadable) -> NamedFailure {
    switch failure.number {
    case AppleEventError.notPermitted:
      var refused = notesPermissionMissing(permission: .refused)
      refused = NamedFailure(
        code: refused.code, sentence: refused.sentence, evidence: failure.evidence)
      return refused
    case AppleEventError.timedOut: return notesTimedOut(evidence: failure.evidence)
    default: return notesUnreadable(evidence: failure.evidence)
    }
  }

  static func messageTextUnreadable(reason: String) -> NamedFailure {
    NamedFailure(
      code: .messageTextUnreadable,
      sentence: "This message's text could not be read from the store, so it is answered "
        + "without it.",
      evidence: reason)
  }

  static func reminderNotSaved(evidence: String) -> NamedFailure {
    NamedFailure(
      code: .reminderNotSaved,
      sentence: "The reminders store would not save the reminder, so nothing was created.",
      evidence: evidence)
  }
}
