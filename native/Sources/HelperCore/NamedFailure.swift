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
  static func calendarPermissionMissing(permission: CalendarPermission) -> NamedFailure {
    NamedFailure(
      code: .calendarPermissionMissing,
      sentence:
        "apple-native-mcp cannot read your calendar until it is allowed to, in \(calendarPermissionSetting).",
      evidence: permission.rawValue)
  }

  static func calendarUnreadable(title: String, evidence: String) -> NamedFailure {
    NamedFailure(
      code: .calendarUnreadable,
      sentence: "The calendar \"\(title)\" could not be read, so its events are missing from this range.",
      evidence: evidence)
  }
}
