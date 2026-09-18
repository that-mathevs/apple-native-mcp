import EventKit
import HelperCore

extension Permission {
  /// What EventKit reports, in the helper's words. The calendar and the reminders each have a
  /// status of their own, in the same five states.
  init(_ status: EKAuthorizationStatus) {
    switch status {
    case .notDetermined: self = .undecided
    case .restricted: self = .restricted
    case .denied: self = .refused
    case .writeOnly: self = .writeOnly
    case .fullAccess: self = .granted
    // A state this helper has never heard of is not a state it may read in.
    @unknown default: self = .restricted
    }
  }

  /// Ask EventKit, which prompts the user, and wait for their answer. The answer arrives on
  /// another thread; the protocol is one line in, one line out, so the session waits here rather
  /// than growing a second shape for the one request that has a person in the middle of it.
  static func asking(
    _ ask: (@escaping @Sendable (Bool, (any Error)?) -> Void) -> Void
  ) -> Permission? {
    let answered = DispatchSemaphore(value: 0)
    // Written before the signal and read after the wait, so the semaphore orders the two.
    nonisolated(unsafe) var granted = false
    nonisolated(unsafe) var failed = false
    ask { allowed, error in
      granted = allowed
      failed = error != nil
      answered.signal()
    }
    answered.wait()
    return .answer(granted: granted, askingFailed: failed)
  }
}
