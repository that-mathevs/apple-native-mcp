import Darwin
import Foundation
import HelperCore

/// Relaunching the helper with responsibility disclaimed.
///
/// macOS attributes a permission prompt, and the grant it leaves behind, to whichever process it
/// holds *responsible*. By default that is whatever started the helper — a Homebrew `node`, or a
/// terminal — so the grant would be shared with every other tool run the same way and would be
/// lost the moment that binary was replaced (ADR-0002, evidence in issue #4).
/// `responsibility_spawnattrs_setdisclaim` tells macOS to hold the child responsible for itself,
/// so the helper's own identity is what the user sees in the prompt and in System Settings.
enum Disclaiming {
  private typealias SetDisclaim = @convention(c) (UnsafeMutablePointer<posix_spawnattr_t?>, Int32)
    -> Int32

  /// Relaunch this executable once, disclaimed, and wait for it.
  ///
  /// Returns the exit status to leave with, or nil when disclaiming was not possible at all, in
  /// which case the caller serves the session itself rather than leaving the user with nothing.
  static func relaunch() -> Int32? {
    guard
      let symbol = dlsym(
        UnsafeMutableRawPointer(bitPattern: -2), "responsibility_spawnattrs_setdisclaim"),
      let executable = executablePath()
    else { return nil }

    var attributes: posix_spawnattr_t?
    guard posix_spawnattr_init(&attributes) == 0 else { return nil }
    defer { posix_spawnattr_destroy(&attributes) }
    guard unsafeBitCast(symbol, to: SetDisclaim.self)(&attributes, 1) == 0 else { return nil }

    let arguments = ([executable] + CommandLine.arguments.dropFirst()).map { strdup($0) } + [nil]
    defer { arguments.forEach { free($0) } }

    var childEnvironment = ProcessInfo.processInfo.environment
    childEnvironment[disclaimedMarkKey] = "1"
    let environment = childEnvironment.map { strdup("\($0.key)=\($0.value)") } + [nil]
    defer { environment.forEach { free($0) } }

    // No file actions, so the child inherits this process's stdin, stdout and stderr and speaks
    // the session directly to whoever started the helper.
    var child: pid_t = 0
    guard posix_spawn(&child, executable, nil, &attributes, arguments, environment) == 0 else {
      return nil
    }

    var status: Int32 = 0
    while waitpid(child, &status, 0) == -1 && errno == EINTR {}
    return exitStatus(of: status)
  }

  private static func executablePath() -> String? {
    var buffer = [UInt8](repeating: 0, count: Int(MAXPATHLEN) * 4)
    let length = proc_pidpath(getpid(), &buffer, UInt32(buffer.count))
    guard length > 0 else { return nil }
    return String(decoding: buffer.prefix(Int(length)), as: UTF8.self)
  }

  /// `waitpid`'s status, as an exit status: what the child exited with, or the shell's convention
  /// of 128 plus the signal that killed it.
  private static func exitStatus(of waited: Int32) -> Int32 {
    let signal = waited & 0x7f
    return signal == 0 ? (waited >> 8) & 0xff : 128 + signal
  }
}
