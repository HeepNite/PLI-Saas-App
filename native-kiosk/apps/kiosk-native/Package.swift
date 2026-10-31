// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KioskNative",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "KioskNative", targets: ["KioskNative"]),
    ],
    targets: [
        .target(name: "KioskNative"),
        .testTarget(name: "KioskNativeTests", dependencies: ["KioskNative"]),
    ]
)
