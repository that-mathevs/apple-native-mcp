/// Where the user turns calendar access on, named in full so a failure never sends them hunting.
public let calendarPermissionSetting = "System Settings > Privacy & Security > Calendars > apple-native-mcp"

/// What macOS currently allows the helper to do with the calendar.
public enum CalendarPermission: String, Equatable, Sendable, CaseIterable {
  /// Nobody has been asked yet.
  case undecided
  /// Something outside the user's control, such as a managed device, withholds it.
  case restricted
  /// The user said no.
  case refused
  /// The helper may add events but not read them.
  case writeOnly
  /// The helper may read events.
  case granted

  /// Only a full grant lets the helper read events; writing is not reading.
  public var allowsReading: Bool { self == .granted }

  /// The setting the user would change to fix this, when changing a setting is what would fix it.
  public var settingToEnable: String? {
    switch self {
    case .granted, .undecided: nil
    case .restricted, .refused, .writeOnly: calendarPermissionSetting
    }
  }
}
