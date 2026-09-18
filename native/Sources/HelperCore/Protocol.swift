import Foundation

/// The protocol version this helper speaks. The server sends it on every request, and a version
/// the helper does not speak is a named failure rather than a crash or a silent guess.
public let spokenProtocolVersion = 1

/// One request, as the helper understood it.
struct Request: Equatable {
  let id: String
  let kind: Kind

  enum Kind: Equatable {
    case calendarPermission
    case requestCalendarPermission
    case calendars
    case eventsInRange(Range)
    case event(identifier: String, originalStart: Date?)
    case defaultCalendar
    case createEvent(NewEvent)
    case remindersPermission
    case requestRemindersPermission
    case reminderLists
    case reminders(reminderLists: [String], includeCompleted: Bool, matching: String?)
    case contactsPermission
    case requestContactsPermission
    case contacts
    case contactNote
    case chats(limit: Int)
    case chatMessages(chat: String, range: MessageRange, limit: Int)
    case messagesToSearch(range: Range, chat: String?, ceiling: Int)
    case notesPermission
    case requestNotesPermission
    case noteFolders
    case notesMentioning(text: String, noteFolders: [String])
    case note(identifier: String, noteFolders: [String])
    case mailPermission
    case requestMailPermission
    case mailAccounts
    case mailboxes(mailAccount: String)
  }
}

/// The names the protocol uses on the wire, kept in one place so a name is never spelled twice.
enum RequestName: String {
  case calendarPermission = "calendar_permission"
  case requestCalendarPermission = "calendar_permission_request"
  case calendars = "calendars"
  case eventsInRange = "events_in_range"
  case event = "event"
  case defaultCalendar = "default_calendar"
  case createEvent = "create_event"
  case remindersPermission = "reminders_permission"
  case requestRemindersPermission = "reminders_permission_request"
  case reminderLists = "reminder_lists"
  case reminders = "reminders"
  case contactsPermission = "contacts_permission"
  case requestContactsPermission = "contacts_permission_request"
  case contacts = "contacts"
  case chats = "chats"
  case chatMessages = "chat_messages"
  case messagesToSearch = "messages_to_search"
  case notesPermission = "notes_permission"
  case requestNotesPermission = "notes_permission_request"
  case noteFolders = "note_folders"
  case notesMentioning = "notes_mentioning"
  case note = "note"
  case mailPermission = "mail_permission"
  case requestMailPermission = "mail_permission_request"
  case mailAccounts = "mail_accounts"
  case mailboxes = "mailboxes"
}

/// What reading a line produced: a request the helper can answer, or a named failure to report
/// under whatever identifier could still be recovered from the line.
enum ReadLine {
  case request(Request)
  case failure(id: String?, NamedFailure)
}

extension Request {
  /// Read one line of the protocol. Nothing here throws: every way a line can be wrong is one of
  /// the helper's named failures.
  static func read(line: String) -> ReadLine {
    guard
      let data = line.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: data),
      let fields = json as? [String: Any]
    else {
      return .failure(id: nil, .requestMalformed(line: line))
    }

    guard let id = fields["id"] as? String, !id.isEmpty else {
      return .failure(id: nil, .requestMalformed(line: line))
    }

    guard let version = fields["protocolVersion"] as? Int else {
      return .failure(id: id, .requestMalformed(line: line))
    }
    guard version == spokenProtocolVersion else {
      return .failure(
        id: id, .protocolVersionUnsupported(spoken: spokenProtocolVersion, asked: version))
    }

    guard let name = fields["request"] as? String else {
      return .failure(id: id, .requestMalformed(line: line))
    }
    guard let known = RequestName(rawValue: name) else {
      return .failure(id: id, .requestUnknown(name: name))
    }

    switch known {
    case .calendarPermission:
      return .request(Request(id: id, kind: .calendarPermission))
    case .requestCalendarPermission:
      return .request(Request(id: id, kind: .requestCalendarPermission))
    case .calendars:
      return .request(Request(id: id, kind: .calendars))
    case .eventsInRange:
      guard let range = readRange(fields["range"]) else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(Request(id: id, kind: .eventsInRange(range)))
    case .event:
      guard let identifier = fields["eventIdentifier"] as? String, !identifier.isEmpty else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      // An original start that cannot be read is refused, never dropped: without it the answer
      // would be the series' first occurrence, which is a different event from the one meant.
      switch OptionalInstant(fields["originalStart"]) {
      case .unreadable:
        return .failure(id: id, .requestMalformed(line: line))
      case .absent:
        return .request(Request(id: id, kind: .event(identifier: identifier, originalStart: nil)))
      case .instant(let originalStart):
        return .request(
          Request(id: id, kind: .event(identifier: identifier, originalStart: originalStart)))
      }
    case .defaultCalendar:
      return .request(Request(id: id, kind: .defaultCalendar))
    case .createEvent:
      guard let event = readNewEvent(fields) else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(Request(id: id, kind: .createEvent(event)))
    case .remindersPermission:
      return .request(Request(id: id, kind: .remindersPermission))
    case .requestRemindersPermission:
      return .request(Request(id: id, kind: .requestRemindersPermission))
    case .reminderLists:
      return .request(Request(id: id, kind: .reminderLists))
    case .reminders:
      // Both are required: the server says which reminder lists and whether completed reminders
      // are wanted, and the helper never chooses either for it.
      guard
        let reminderLists = fields["reminderLists"] as? [String],
        let includeCompleted = fields["includeCompleted"] as? Bool
      else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      // Text to match is optional, but when it is there it has to say something: blank text would
      // match every reminder while seeming to have searched.
      let matching = fields["matching"]
      let saysSomething = (matching as? String).map {
        !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      }
      guard matching == nil || saysSomething == true else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      let kind = Request.Kind.reminders(
        reminderLists: reminderLists, includeCompleted: includeCompleted,
        matching: matching as? String)
      return .request(Request(id: id, kind: kind))
    case .contactsPermission:
      return .request(Request(id: id, kind: .contactsPermission))
    case .requestContactsPermission:
      return .request(Request(id: id, kind: .requestContactsPermission))
    case .contacts:
      // The one thing that may be asked for besides the contacts is the one thing that cannot
      // be had. Asking for it is understood and refused by name; anything else is not a request.
      switch fields["include"] as? [String] ?? [] {
      case []: return .request(Request(id: id, kind: .contacts))
      case ["note"]: return .request(Request(id: id, kind: .contactNote))
      default: return .failure(id: id, .requestMalformed(line: line))
      }
    case .chats:
      guard let limit = readLimit(fields["limit"]) else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(Request(id: id, kind: .chats(limit: limit)))
    case .chatMessages:
      guard
        let chat = fields["chat"] as? String, !chat.isEmpty,
        let limit = readLimit(fields["limit"]),
        let range = readMessageRange(fields["range"])
      else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(Request(id: id, kind: .chatMessages(chat: chat, range: range, limit: limit)))
    case .messagesToSearch:
      // The range is required, as the server's default is its own to choose, and so is the
      // ceiling. A chat may be left out with null, meaning every chat.
      let chat = fields["chat"]
      guard
        let range = readRange(fields["range"]),
        let ceiling = fields["ceiling"] as? Int, (1...greatestSearchCeiling).contains(ceiling),
        chat is NSNull || (chat as? String).map({ !$0.isEmpty }) == true
      else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      let kind = Request.Kind.messagesToSearch(
        range: range, chat: chat as? String, ceiling: ceiling)
      return .request(Request(id: id, kind: kind))
    case .notesPermission:
      return .request(Request(id: id, kind: .notesPermission))
    case .requestNotesPermission:
      return .request(Request(id: id, kind: .requestNotesPermission))
    case .noteFolders:
      return .request(Request(id: id, kind: .noteFolders))
    case .notesMentioning:
      // Both are required: the server says what to look for and in which note folders, and the
      // helper never chooses either for it. Empty text would mention every note there is.
      guard
        let text = fields["text"] as? String, !text.isEmpty,
        let noteFolders = fields["noteFolders"] as? [String]
      else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(
        Request(id: id, kind: .notesMentioning(text: text, noteFolders: noteFolders)))
    case .note:
      // The server says which note folders the note may be read from, so the text of a note
      // kept anywhere else never leaves Notes. The helper never decides that for it.
      guard
        let identifier = fields["identifier"] as? String, !identifier.isEmpty,
        let noteFolders = fields["noteFolders"] as? [String]
      else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(
        Request(id: id, kind: .note(identifier: identifier, noteFolders: noteFolders)))
    case .mailPermission:
      return .request(Request(id: id, kind: .mailPermission))
    case .requestMailPermission:
      return .request(Request(id: id, kind: .requestMailPermission))
    case .mailAccounts:
      return .request(Request(id: id, kind: .mailAccounts))
    case .mailboxes:
      // The mail account is required: the helper has no way to read every account at once.
      guard let mailAccount = fields["mailAccount"] as? String, !mailAccount.isEmpty else {
        return .failure(id: id, .requestMalformed(line: line))
      }
      return .request(Request(id: id, kind: .mailboxes(mailAccount: mailAccount)))
    }
  }
}

/// A range of messages, either bound left open by leaving it out or writing null. A bound that
/// is written but is not an instant is refused, never read as open.
private func readMessageRange(_ field: Any?) -> MessageRange? {
  guard let field, !(field is NSNull) else { return .unbounded }
  guard let bounds = field as? [String: Any] else { return nil }

  func bound(_ name: String) -> Date?? {
    switch OptionalInstant(bounds[name] is NSNull ? nil : bounds[name]) {
    case .absent: return .some(nil)
    case .instant(let instant): return .some(instant)
    case .unreadable: return nil
    }
  }

  guard let start = bound("start"), let end = bound("end") else { return nil }
  // A range has to move forwards, as a calendar's does: one that ends at or before it starts
  // would answer with no messages, which reads as a quiet chat.
  if let start, let end, end <= start { return nil }
  return MessageRange(start: start, end: end)
}

/// The most messages one search scans, whatever the server asks.
let greatestSearchCeiling = 20_000

/// The most a read of the message store answers with at once, whatever the server asks.
let greatestReadLimit = 500

/// A limit is required and must be one the helper answers: it never picks one for the server.
private func readLimit(_ field: Any?) -> Int? {
  guard let limit = field as? Int, (1...greatestReadLimit).contains(limit) else { return nil }
  return limit
}

/// A range arrives as two instants. The helper never invents one: deciding what "this week" means
/// belongs to the server, which knows the user's time zone.
private func readRange(_ field: Any?) -> Range? {
  guard
    let bounds = field as? [String: Any],
    let startText = bounds["start"] as? String,
    let endText = bounds["end"] as? String,
    let start = Instant.read(startText),
    let end = Instant.read(endText)
  else { return nil }
  return Range(from: start, to: end)
}

/// An instant a request may leave out. Leaving it out is one thing and writing something that
/// is not an instant is another, and only the first may be treated as "none".
private enum OptionalInstant {
  case absent
  case instant(Date)
  case unreadable

  init(_ field: Any?) {
    guard let field else {
      self = .absent
      return
    }
    guard let text = field as? String, let instant = Instant.read(text) else {
      self = .unreadable
      return
    }
    self = .instant(instant)
  }
}

/// A new event names its calendar and its title, and says when it is in exactly one way: a start
/// and an end, or a first and a last day. Anything else is refused rather than completed.
private func readNewEvent(_ fields: [String: Any]) -> NewEvent? {
  guard
    let calendar = fields["calendarIdentifier"] as? String, !calendar.isEmpty,
    let title = fields["title"] as? String,
    let time = readEventTime(fields)
  else { return nil }

  return NewEvent(
    title: title, calendarIdentifier: calendar, time: time,
    location: fields["location"] as? String, notes: fields["notes"] as? String)
}

private func readEventTime(_ fields: [String: Any]) -> EventTime? {
  let timed = fields["start"] != nil || fields["end"] != nil
  let allDay = fields["firstDay"] != nil || fields["lastDay"] != nil
  guard timed != allDay else { return nil }

  if timed {
    return readRange(["start": fields["start"] as Any, "end": fields["end"] as Any])
      .map(EventTime.timed)
  }

  guard
    let first = (fields["firstDay"] as? String).flatMap(Day.init),
    let last = (fields["lastDay"] as? String).flatMap(Day.init),
    last >= first
  else { return nil }
  return .allDay(firstDay: first, lastDay: last)
}
