import Darwin
import Foundation
import HelperCore

// The helper starts twice. The first process exists only to relaunch itself with responsibility
// disclaimed, so that macOS attributes the calendar prompt, and the grant behind it, to
// apple-native-mcp rather than to whatever started it (ADR-0002). The second serves the session.
switch startingChoice(environment: ProcessInfo.processInfo.environment) {
case .relaunchDisclaimed:
  if let status = Disclaiming.relaunch() { exit(status) }
  // Disclaiming is the whole point, but refusing to run would leave the user with nothing at all.
  // Serve anyway, and say on stderr whose name the permission will end up in.
  write(
    "apple-native-mcp could not disclaim responsibility, so macOS will attribute its permissions "
      + "to whatever started it.", to: FileHandle.standardError)
  serveSession(Helper(calendarStore: EventKitCalendarStore()))
case .serveSession:
  serveSession(Helper(calendarStore: EventKitCalendarStore()))
}
