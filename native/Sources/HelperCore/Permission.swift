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

  /// Adding is allowed by a full grant and by one that covers writing only.
  public var allowsWriting: Bool { self == .granted || self == .writeOnly }

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

extension Permission {
  /// What the user answered, if they answered at all. EventKit also says "not granted" when
  /// asking failed before anyone saw a prompt, and that is no refusal: calling it one would send
  /// the user to a setting macOS never created, and stop the helper asking again.
  public static func answer(granted: Bool, askingFailed: Bool) -> Permission? {
    guard !askingFailed else { return nil }
    return granted ? .granted : .refused
  }

  /// What macOS allows, from what it reports and what the user answered in this process.
  ///
  /// Straight after the user answers, EventKit can go on reporting a permission as undecided for
  /// the rest of the process, while the answer it gave is already true (#57). So an answer stands
  /// in for an undecided report, and anything else macOS reports wins.
  public static func held(reported: Permission, answered: Permission?) -> Permission {
    reported == .undecided ? (answered ?? .undecided) : reported
  }
}

extension Permission {
  /// Do the work only while this permission allows it, and otherwise refuse with the failure
  /// that names what to change. Reading and writing ask for different things: a write-only
  /// grant allows adding and no more.
  func whenItAllows<Answer>(
    _ allows: KeyPath<Permission, Bool>, else missing: (Permission) -> NamedFailure,
    _ work: () -> Result<Answer, NamedFailure>
  ) -> Result<Answer, NamedFailure> {
    self[keyPath: allows] ? work() : .failure(missing(self))
  }
}

/// Where the user turns calendar access on, named in full so a failure never sends them hunting.
public let calendarPermissionSetting =
  "System Settings > Privacy & Security > Calendars > apple-native-mcp"

/// Where the user turns reminders access on.
public let remindersPermissionSetting =
  "System Settings > Privacy & Security > Reminders > apple-native-mcp"

/// Where the user turns contacts access on.
public let contactsPermissionSetting =
  "System Settings > Privacy & Security > Contacts > apple-native-mcp"

/// Where the user lets the helper read the message store. There is no prompt for this one: it
/// can only be turned on here, by hand.
public let messageStorePermissionSetting =
  "System Settings > Privacy & Security > Full Disk Access > apple-native-mcp"

/// Where the user lets the helper control Notes. Scripting an app is an Automation consent,
/// separate from every other permission and granted per app.
public let notesPermissionSetting =
  "System Settings > Privacy & Security > Automation > apple-native-mcp > Notes"
