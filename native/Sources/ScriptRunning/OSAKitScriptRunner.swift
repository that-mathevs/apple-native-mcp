import AppKit
import Foundation
import HelperCore
import OSAKit

/// The one place OSAKit is touched. A script runs inside the helper's own process, so the Apple
/// Events it sends are the helper's, and the Automation consent macOS asks for is the helper's
/// too (ADR-0002). Nothing is ever handed to `/usr/bin/osascript`, and nothing is written to disk.
public final class OSAKitScriptRunner: ScriptRunner, @unchecked Sendable {
  private let lock = NSLock()
  private var gaveUp = false

  public init() {}

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
    // Written by the worker before it signals and read here after the wait, so the semaphore
    // orders the two. After a timeout the worker's late result is simply never read.
    nonisolated(unsafe) var outcome: Result<Data, ScriptFailed> = .failure(.answeredWithoutJSON)

    let worker = Thread {
      outcome = Self.executing(script, with: argumentsJson)
      finished.signal()
    }
    worker.stackSize = Self.workerStack
    worker.start()

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

  /// JavaScript for Automation recurses through a large answer, and a thread's default half a
  /// megabyte of stack is not enough for a two-megabyte one.
  private static let workerStack = 8 << 20

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
