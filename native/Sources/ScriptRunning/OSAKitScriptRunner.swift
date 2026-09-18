import AppKit
import Foundation
import HelperCore
import OSAKit

/// The one place OSAKit is touched. A script runs inside the helper's own process, so the Apple
/// Events it sends are the helper's, and the permission macOS asks for is the helper's too
/// (ADR-0002). Nothing is ever handed to `/usr/bin/osascript`, and nothing is written to disk.
///
/// Scripts run on the main thread, which has to be running the main run loop, while the caller
/// waits on another thread. Run from a worker thread while the main thread sat blocked, a script's
/// Apple Event sometimes never got its reply: against Mail, 30 runs in one process hung within 15,
/// and on the main thread none of 120 did (#44). `osascript` runs its scripts there too.
public final class OSAKitScriptRunner: ScriptRunner, @unchecked Sendable {
  /// Where scripts run. The helper gives them its main thread, which is the only place a script
  /// that talks to an app reliably hears back. A process that does not own its main thread, such
  /// as a test runner, gives each script a thread of its own, which is sound only for scripts
  /// that talk to no app: they have no reply to lose.
  public enum ScriptThread: Sendable {
    case main
    case itsOwn
  }

  private let scriptThread: ScriptThread
  private let lock = NSLock()
  private var gaveUp = false

  public init(runningScriptsOn scriptThread: ScriptThread = .main) {
    self.scriptThread = scriptThread
  }

  /// How long an app is given to start before macOS is asked about it again. A cold start of
  /// Mail measured 4.1 seconds (#7), and this has to fit inside a request's time budget.
  private static let startingWait: TimeInterval = 5

  /// Whether a script was given up on when its time budget ran out. Nothing can cancel a script
  /// in flight, and the app it is talking to stays busy with it, so the helper stops once it has
  /// said so and the server starts a fresh one (#7: Mail stayed unresponsive for minutes).
  public var hasGivenUpOnAScript: Bool {
    lock.withLock { gaveUp }
  }

  public func run(
    _ script: StaticScript, arguments: [String: Any], within seconds: TimeInterval
  ) throws(ScriptFailed) -> Data {
    // A script given up on is still running. A second one would queue behind it in the same
    // app, and OSAKit is not to be entered by two threads at once.
    guard !hasGivenUpOnAScript else { throw ScriptFailed.helperIsStopping }

    guard
      let json = try? JSONSerialization.data(withJSONObject: arguments),
      let argumentsJson = String(data: json, encoding: .utf8)
    else {
      throw ScriptFailed(number: 0, message: "The arguments could not be written as JSON.")
    }

    let finished = DispatchSemaphore(value: 0)
    // Written on the main thread before it signals and read here after the wait, so the
    // semaphore orders the two. After a timeout the late result is simply never read.
    nonisolated(unsafe) var outcome: Result<Data, ScriptFailed> = .failure(.answeredWithoutJSON)

    let running = {
      outcome = Self.executing(script, with: argumentsJson)
      finished.signal()
    }

    switch scriptThread {
    case .main:
      // The caller must not be the main thread, or it would wait here for itself: the helper's
      // session has a thread of its own for exactly this reason.
      precondition(!Thread.isMainThread, "a script is asked for from the session's thread")
      DispatchQueue.main.async(execute: running)
    case .itsOwn:
      let thread = Thread(block: running)
      // JavaScript for Automation recurses through a large answer, and a thread's default half a
      // megabyte of stack is not enough for a two-megabyte one. The main thread has eight.
      thread.stackSize = 8 << 20
      thread.start()
    }

    guard finished.wait(timeout: .now() + seconds) == .success else {
      lock.withLock { gaveUp = true }
      throw ScriptFailed.timedOut(after: seconds)
    }
    return try outcome.get()
  }

  /// Why a script does not compile, or nil when it does.
  public func whyItDoesNotCompile(_ script: StaticScript) -> ScriptFailed? {
    var problem: NSDictionary?
    let compiled = OSAScript(source: script.source, language: Self.javaScript)
    return compiled.compileAndReturnError(&problem) ? nil : Self.failure(from: problem)
  }

  /// Asked from the caller's own thread and never the main one: with `asking`, macOS blocks the
  /// caller for as long as the prompt is up, and Apple says not to make that the main thread.
  public func automationPermission(
    for app: ScriptedApp, asking: Bool
  ) throws(ScriptFailed) -> Permission {
    if let held = try Self.permission(toAutomate: app, asking: asking) { return held }

    // macOS can only answer for an app that is running. One that is not is started without being
    // brought to the front, and asked about again. An app that will not start is a failure that
    // says so, never a permission nobody has been asked for (NOT-13).
    guard
      Self.startInTheBackground(app),
      let held = try Self.permission(toAutomate: app, asking: asking)
    else { throw ScriptFailed.didNotStart(app, within: Self.startingWait) }
    return held
  }

  // MARK: OSAKit

  /// JavaScript for Automation ships with macOS. Were it ever missing, OSAKit falls back to its
  /// default language, which fails to compile these scripts: a failure that says so.
  private static var javaScript: OSALanguage? { OSALanguage(forName: "JavaScript") }

  private static func executing(
    _ script: StaticScript, with argumentsJson: String
  ) -> Result<Data, ScriptFailed> {
    var problem: NSDictionary?
    let compiled = OSAScript(source: script.source, language: javaScript)

    guard
      let answer = compiled.executeHandler(
        withName: "run", arguments: [argumentsJson], error: &problem)
    else { return .failure(failure(from: problem)) }

    // Only JSON is an answer. Anything else a script printed is refused rather than passed on.
    guard
      let text = answer.stringValue, let json = text.data(using: .utf8),
      (try? JSONSerialization.jsonObject(with: json)) != nil
    else { return .failure(.answeredWithoutJSON) }

    return .success(json)
  }

  private static func failure(from problem: NSDictionary?) -> ScriptFailed {
    ScriptFailed(
      number: (problem?[OSAScriptErrorNumberKey] as? NSNumber)?.intValue ?? 0,
      message: problem?[OSAScriptErrorMessageKey] as? String ?? "The script failed.")
  }

  // MARK: Automation consent

  /// What macOS says about controlling an app, or nil when the app is not running to be asked
  /// about. Asking is what shows the user the prompt, and is only ever done for `setup`. A status
  /// the helper has never heard of is a failure carrying that status, never a guess at a state.
  private static func permission(
    toAutomate app: ScriptedApp, asking: Bool
  ) throws(ScriptFailed) -> Permission? {
    let target = NSAppleEventDescriptor(bundleIdentifier: app.bundleIdentifier)
    let status = Int(
      AEDeterminePermissionToAutomateTarget(target.aeDesc, typeWildCard, typeWildCard, asking))

    switch status {
    case Int(noErr): return .granted
    case AppleEventError.notPermitted: return .refused
    case AppleEventError.wouldAskTheUser: return .undecided
    case AppleEventError.notRunning: return nil
    default:
      throw ScriptFailed(
        number: status, message: "macOS would not say whether \(app.name) may be controlled.")
    }
  }

  private static func startInTheBackground(_ app: ScriptedApp) -> Bool {
    guard
      let location = NSWorkspace.shared.urlForApplication(
        withBundleIdentifier: app.bundleIdentifier)
    else { return false }

    let quietly = NSWorkspace.OpenConfiguration()
    quietly.activates = false
    quietly.hides = true
    quietly.addsToRecentItems = false

    let started = DispatchSemaphore(value: 0)
    nonisolated(unsafe) var running = false
    NSWorkspace.shared.openApplication(at: location, configuration: quietly) { opened, _ in
      running = opened != nil
      started.signal()
    }
    return started.wait(timeout: .now() + startingWait) == .success && running
  }
}
