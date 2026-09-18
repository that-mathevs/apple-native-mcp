import Foundation

/// How an instant is written on the wire: ISO 8601 with an offset, seconds' precision.
///
/// A formatter is built per call rather than shared, because the Foundation formatters are not
/// safe to share across tasks and a protocol line is not a hot loop.
enum Instant {
  /// Read an instant. JavaScript's `Date.toISOString()` writes fractional seconds and Swift's
  /// default reader rejects them, so both spellings are accepted.
  static func read(_ text: String) -> Date? {
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let instant = withFraction.date(from: text) { return instant }

    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    return plain.date(from: text)
  }

  /// Write an instant, always in UTC, so two helpers on two Macs write the same answer.
  static func written(_ instant: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: instant)
  }
}
