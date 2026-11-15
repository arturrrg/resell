// swift-tools-version:5.3
import PackageDescription

let package = Package(
  name: "tauri-plugin-marketplace",
  platforms: [.iOS(.v13)],
  products: [.library(name: "tauri-plugin-marketplace", type: .static, targets: ["tauri-plugin-marketplace"])],
  dependencies: [.package(name: "Tauri", path: "../.tauri/tauri-api")],
  targets: [.target(name: "tauri-plugin-marketplace", dependencies: [.byName(name: "Tauri")], path: "Sources")]
)
