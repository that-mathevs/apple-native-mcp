import Foundation

/// The helper: one JSON request per line in, one JSON response per line out.
///
/// `respond(to:)` is the whole protocol. It takes a line and gives back a line, so the session that
/// pumps stdio holds no rules and the rules are specified without a pipe, a permission or a
/// single real event.
public struct Helper: Sendable {
  private let calendar: CalendarReading
  private let calendarWriting: CalendarWriting
  private let reminders: RemindersReading

  public init(calendarStore: CalendarStore, reminderStore: ReminderStore) {
    self.calendar = CalendarReading(store: calendarStore)
    self.calendarWriting = CalendarWriting(store: calendarStore)
    self.reminders = RemindersReading(store: reminderStore)
  }

  /// Answer one line. Always returns exactly one line of JSON, whatever arrives.
  public func respond(to line: String) -> String {
    switch Request.read(line: line) {
    case .failure(let id, let failure):
      return responseLine(id: id, body: ["failure": failure.asFields])
    case .request(let request):
      return responseLine(id: request.id, body: answer(request.kind))
    }
  }

  private func answer(_ kind: Request.Kind) -> [String: Any] {
    switch kind {
    case .calendarPermission:
      return ["result": calendar.permission().asFields(setting: calendarPermissionSetting)]
    case .requestCalendarPermission:
      return ["result": calendar.requestPermission().asFields(setting: calendarPermissionSetting)]
    case .calendars:
      return answering(calendar.calendars()) { ["calendars": $0.map(\.asFields)] }
    case .event(let identifier, let originalStart):
      return answering(calendar.event(identifier: identifier, originalStart: originalStart)) {
        ["event": $0.map { $0.asFields as Any } ?? NSNull()]
      }
    case .eventsInRange(let range):
      return answering(calendar.events(in: range)) { $0.asFields }
    case .defaultCalendar:
      return answering(calendarWriting.defaultCalendar()) {
        ["calendar": $0.map { $0.asFields as Any } ?? NSNull()]
      }
    case .createEvent(let event):
      return answering(calendarWriting.create(event)) {
        ["event": $0.event.asFields, "confirmed": $0.confirmed]
      }
    case .remindersPermission:
      return ["result": reminders.permission().asFields(setting: remindersPermissionSetting)]
    case .requestRemindersPermission:
      return [
        "result": reminders.requestPermission().asFields(setting: remindersPermissionSetting)
      ]
    case .reminderLists:
      return answering(reminders.reminderLists()) { ["reminderLists": $0.map(\.asFields)] }
    case .reminders(let reminderLists, let includeCompleted):
      let read = reminders.reminders(
        inReminderListsNamed: reminderLists, includingCompleted: includeCompleted)
      return answering(read) {
        [
          "reminders": $0.reminders.map(\.asFields),
          "unreadReminderLists": $0.unreadReminderLists.map(\.asFields),
        ]
      }
    }
  }

  /// A read either came to something, which goes out as the result, or was refused, which goes
  /// out as the named failure it was refused with.
  private func answering<Found>(
    _ read: Result<Found, NamedFailure>, as fields: (Found) -> [String: Any]
  ) -> [String: Any] {
    switch read {
    case .success(let found): ["result": fields(found)]
    case .failure(let failure): ["failure": failure.asFields]
    }
  }
}

extension ReminderList {
  var asFields: [String: Any] {
    ["identifier": identifier, "title": title, "account": account.asFields]
  }
}

extension Reminder {
  var asFields: [String: Any] {
    [
      "identifier": identifier,
      "title": title,
      "completed": isCompleted,
      "due": due?.asFields ?? NSNull(),
      "reminderList": reminderList.asFields,
    ]
  }
}

extension Due {
  /// A due date is written as the day alone, never as the instant its midnight falls on
  /// somewhere; a due time as the instant, which the server shows in the user's time zone.
  var asFields: [String: Any] {
    switch self {
    case .date(let year, let month, let day):
      ["date": String(format: "%04d-%02d-%02d", year, month, day)]
    case .time(let instant):
      ["time": Instant.written(instant)]
    }
  }
}

extension EventsInRange {
  var asFields: [String: Any] {
    [
      "range": range.asFields,
      "events": events.map(\.asFields),
      "calendars": calendars.map(\.asFields),
      "unreadableCalendars": unreadableCalendars.map(\.asFields),
    ]
  }
}

extension UnreadableCalendar {
  var asFields: [String: Any] {
    failure.asFields.merging(["calendar": calendar.asFields]) { failureField, _ in failureField }
  }
}

extension Range {
  var asFields: [String: Any] {
    ["start": Instant.written(start), "end": Instant.written(end)]
  }
}

extension Event {
  var asFields: [String: Any] {
    [
      "eventIdentifier": eventIdentifier,
      "title": title,
      "start": Instant.written(start),
      "end": Instant.written(end),
      "allDay": isAllDay,
      "location": location ?? NSNull(),
      "notes": notes ?? NSNull(),
      "originalStart": originalStart.map(Instant.written) ?? NSNull(),
      "calendar": calendar.asFields,
    ]
  }
}

extension Calendar {
  var asFields: [String: Any] {
    [
      "identifier": identifier, "title": title, "account": account.asFields,
      "acceptsNewEvents": acceptsNewEvents,
    ]
  }
}

extension CalendarAccount {
  var asFields: [String: Any] {
    ["identifier": identifier, "title": title]
  }
}

extension NamedFailure {
  var asFields: [String: Any] {
    ["code": code.rawValue, "sentence": sentence, "evidence": evidence]
  }
}

extension Permission {
  /// The state, and the setting that would change it when a setting is what would.
  func asFields(setting: String) -> [String: Any] {
    var fields: [String: Any] = ["state": rawValue]
    if isFixedInSettings { fields["setting"] = setting }
    return fields
  }
}

/// Build one line of the protocol. Keys are sorted so the same answer is always the same line, and
/// JSON escaping guarantees a response never carries a newline of its own: one response, one line.
func responseLine(id: String?, body: [String: Any]) -> String {
  var fields: [String: Any] = body
  fields["protocolVersion"] = spokenProtocolVersion
  fields["id"] = id ?? NSNull()
  guard
    let data = try? JSONSerialization.data(
      withJSONObject: fields, options: [.sortedKeys, .withoutEscapingSlashes]),
    let line = String(data: data, encoding: .utf8)
  else {
    return unserialisableResponseLine
  }
  return line
}

/// The last resort, written by hand so that even a response the helper could not serialise is
/// still one line of protocol JSON and never stray text on stdout.
let unserialisableResponseLine =
  #"{"id":null,"protocolVersion":1,"failure":{"code":"request_malformed","evidence":"","sentence":"The helper could not read that line as a request."}}"#
