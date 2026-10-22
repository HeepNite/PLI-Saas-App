// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KioskNativeBridge",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "KioskNativeBridge", targets: ["KioskNativeBridge"]),
    ],
    targets: [
        .target(name: "KioskNativeBridge"),
        .testTarget(name: "KioskNativeBridgeTests", dependencies: ["KioskNativeBridge"]),
    ]
)
