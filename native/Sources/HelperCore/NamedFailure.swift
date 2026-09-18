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
}
