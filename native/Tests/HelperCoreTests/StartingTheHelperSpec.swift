import Testing

@testable import HelperCore

@Suite("starting the helper")
struct StartingTheHelperSpec {
  // macOS attributes a permission to whichever process it holds responsible, which by default is
  // whatever started the helper: a Homebrew `node`, or a terminal (ADR-0002, evidence in #4).
  // Disclaiming responsibility puts the grant on the helper's own identity instead.
  @Test("given nothing saying responsibility was disclaimed, relaunches itself so macOS holds the helper responsible")
  func relaunchesDisclaimed() {
    #expect(startingChoice(environment: [:]) == .relaunchDisclaimed)
  }

  @Test("given the mark its own relaunch leaves behind, serves the session instead of relaunching again")
  func servesTheSessionOnce() {
    #expect(startingChoice(environment: [disclaimedMarkKey: "1"]) == .serveSession)
  }

  @Test("given an empty mark, relaunches: an inherited but blank variable is not a disclaimed relaunch")
  func ignoresABlankMark() {
    #expect(startingChoice(environment: [disclaimedMarkKey: ""]) == .relaunchDisclaimed)
  }
}
