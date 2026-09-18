import Darwin
import Foundation
import HelperCore

// The helper starts twice. The first process exists only to relaunch itself with responsibility
// disclaimed, so that macOS attributes each permission prompt, and the grant behind it, to
// apple-native-mcp rather than to whatever started it (ADR-0002). The second serves the session.

/// The helper that serves the session. It is built only in the process that serves, so the one
/// that relaunches never opens a store macOS would attribute to whatever started it.
func servingTheSession() {
  exitingWithTheParent()
  serveSession(
    Helper(
      calendarStore: EventKitCalendarStore(), reminderStore: EventKitReminderStore(),
      contactStore: FrameworkContactStore(),
      messageStore: SQLiteMessageStore(
        path: FileManager.default.homeDirectoryForCurrentUser
          .appendingPathComponent("Library/Messages/chat.db").path)))
}

/// Kept for the life of the process, or the watch would end with the function that started it.
nonisolated(unsafe) var parentWatch: DispatchSourceProcess?

/// End when the process that started this one ends, watched on a queue of its own so that even a
/// session stuck on a request goes. The server stops a stuck helper by ending the process it
/// launched, which is the relaunching parent; without this, the child serving the session would
/// run on with nobody left to ask it anything (#61).
func exitingWithTheParent() {
  let parent = getppid()
  // Already gone: this process has been handed to launchd.
  guard parent != 1 else { exit(0) }

  let watch = DispatchSource.makeProcessSource(
    identifier: parent, eventMask: .exit, queue: .global())
  watch.setEventHandler { exit(0) }
  watch.resume()
  parentWatch = watch
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
