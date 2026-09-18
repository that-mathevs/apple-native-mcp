// swift-tools-version:6.0
import Foundation
import PackageDescription

// The bundle identifier and the EventKit usage strings are linked into the executable's
// __TEXT,__info_plist section, so a bare executable still carries an identity macOS can
// attribute a permission prompt to (ADR-0002, ADR-0003). The path has to be absolute at
// link time, so it is derived from this manifest's own location.
let embeddedInfoPlist = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent()
  .appendingPathComponent("Info.plist")
  .path

let package = Package(
  name: "apple-native-mcp",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "apple-native-mcp", targets: ["Helper"])
  ],
  targets: [
    .target(name: "HelperCore"),
    .executableTarget(
      name: "Helper",
      dependencies: ["HelperCore"],
      linkerSettings: [
        .unsafeFlags([
          "-Xlinker", "-sectcreate",
          "-Xlinker", "__TEXT",
          "-Xlinker", "__info_plist",
          "-Xlinker", embeddedInfoPlist,
        ])
      ]
    ),
    .testTarget(name: "HelperCoreTests", dependencies: ["HelperCore"]),
  ]
)
