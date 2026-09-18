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
  }
}

/// The names the protocol uses on the wire, kept in one place so a name is never spelled twice.
enum RequestName: String {
  case calendarPermission = "calendar_permission"
  case requestCalendarPermission = "calendar_permission_request"
  case calendars = "calendars"
  case eventsInRange = "events_in_range"
  case event = "event"
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
    }
  }
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
