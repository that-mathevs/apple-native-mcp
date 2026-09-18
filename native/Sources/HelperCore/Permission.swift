/// What macOS currently allows the helper to do with one store it guards: the calendar or the
/// reminders. Each is its own permission, granted and refused on its own.
public enum Permission: String, Equatable, Sendable, CaseIterable {
  /// Nobody has been asked yet.
  case undecided
  /// Something outside the user's control, such as a managed device, withholds it.
  case restricted
  /// The user said no.
  case refused
  /// The helper may add but not read.
  case writeOnly
  /// The helper may read.
  case granted

  /// Only a full grant lets the helper read; writing is not reading.
  public var allowsReading: Bool { self == .granted }

  /// Whether changing a setting is what would fix this. Nothing needs fixing once granted, and
  /// while nobody has been asked, asking is the fix.
  public var isFixedInSettings: Bool {
    switch self {
    case .granted, .undecided: false
    case .restricted, .refused, .writeOnly: true
    }
  }
}

extension Permission {
  /// Ask the user, but only while there is anything to ask: macOS prompts once, so once a
  /// permission has been decided the answer is the setting to change, not another prompt.
  static func askingOnce(held: Permission, ask: () -> Permission) -> Permission {
    held == .undecided ? ask() : held
  }
}

/// Where the user turns calendar access on, named in full so a failure never sends them hunting.
public let calendarPermissionSetting =
  "System Settings > Privacy & Security > Calendars > apple-native-mcp"

/// Where the user turns reminders access on.
public let remindersPermissionSetting =
  "System Settings > Privacy & Security > Reminders > apple-native-mcp"
