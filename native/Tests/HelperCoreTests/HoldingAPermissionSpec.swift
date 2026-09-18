import Testing

@testable import HelperCore

// #57: after the user allowed reminders, EventKit went on reporting them as undecided for the rest
// of the process, so the helper said "undecided" to a user who had just clicked Allow.
@Suite("holding a permission once the user has answered")
struct HoldingAPermissionSpec {
  @Test("given the user allowed it and macOS still reports it undecided, holds it as granted")
  func trustsAnAllowOverAStaleReport() {
    #expect(Permission.held(reported: .undecided, answered: .granted) == .granted)
  }

  @Test("given the user refused it and macOS still reports it undecided, holds it as refused")
  func trustsARefusalOverAStaleReport() {
    #expect(Permission.held(reported: .undecided, answered: .refused) == .refused)
  }

  @Test("given macOS has caught up, holds what macOS reports, whatever the answer was")
  func letsMacOSWinOnceItReports() {
    #expect(Permission.held(reported: .restricted, answered: .granted) == .restricted)
  }

  @Test("given nobody has been asked, holds the permission as undecided")
  func staysUndecidedUntilAsked() {
    #expect(Permission.held(reported: .undecided, answered: nil) == .undecided)
  }
}

@Suite("what counts as the user's answer")
struct TheUsersAnswerSpec {
  @Test("given the user allowed it, the answer is a grant")
  func anAllowIsAGrant() {
    #expect(Permission.answer(granted: true, askingFailed: false) == .granted)
  }

  @Test("given the user refused it, the answer is a refusal")
  func aRefusalIsARefusal() {
    #expect(Permission.answer(granted: false, askingFailed: false) == .refused)
  }

  // A refusal would send the user to a setting macOS never created, and stop the helper asking.
  @Test("given asking failed before the user answered, there is no answer, so no refusal is claimed")
  func aFailedAskIsNoAnswer() {
    #expect(Permission.answer(granted: false, askingFailed: true) == nil)
  }
}
