import Darwin
import Foundation
import HelperCore

// The helper starts twice. The first process exists only to relaunch itself with responsibility
// disclaimed, so that macOS attributes each permission prompt, and the grant behind it, to
// apple-native-mcp rather than to whatever started it (ADR-0002). The second serves the session.

/// The helper that serves the session. It is built only in the process that serves, so the one
/// that relaunches never opens a store macOS would attribute to whatever started it.
func servingTheSession() {
  serveSession(
    Helper(calendarStore: EventKitCalendarStore(), reminderStore: EventKitReminderStore()))
}

switch startingChoice(environment: ProcessInfo.processInfo.environment) {
case .relaunchDisclaimed:
  if let status = Disclaiming.relaunch() { exit(status) }
  // Disclaiming is the whole point, but refusing to run would leave the user with nothing at all.
  // Serve anyway, and say on stderr whose name the permission will end up in.
  write(
    "apple-native-mcp could not disclaim responsibility, so macOS will attribute its permissions "
      + "to whatever started it.", to: FileHandle.standardError)
  servingTheSession()
case .serveSession:
  servingTheSession()
}
