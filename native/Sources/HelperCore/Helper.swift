import Foundation

/// The helper: one JSON request per line in, one JSON response per line out.
///
/// `respond(to:)` is the whole protocol. It takes a line and gives back a line, so the session that
/// pumps stdio holds no rules and the rules are specified without a pipe, a permission or a
/// single real event.
public struct Helper: Sendable {
  private let calendar: CalendarReading

  public init(calendarStore: CalendarStore) {
    self.calendar = CalendarReading(store: calendarStore)
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
      return ["result": calendar.permission().asFields]
    case .eventsInRange(let range):
      switch calendar.events(in: range) {
      case .success(let found): return ["result": found.asFields]
      case .failure(let failure): return ["failure": failure.asFields]
      }
    }
  }
}

extension EventsInRange {
  var asFields: [String: Any] {
    [
      "range": range.asFields,
      "events": events.map(\.asFields),
      "unreadableCalendars": unreadableCalendars.map(\.asFields),
    ]
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
    ["identifier": identifier, "title": title, "account": account.asFields]
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

extension CalendarPermission {
  var asFields: [String: Any] {
    var fields: [String: Any] = ["state": rawValue]
    if let setting = settingToEnable { fields["setting"] = setting }
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
