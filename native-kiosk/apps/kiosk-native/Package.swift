// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KioskNativeBridge",
    products: [
        .library(name: "KioskNativeBridge", targets: ["KioskNativeBridge"]),
    ],
    targets: [
        .target(name: "KioskNativeBridge"),
        .testTarget(name: "KioskNativeBridgeTests", dependencies: ["KioskNativeBridge"]),
    ]
)
