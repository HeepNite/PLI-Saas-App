import Foundation
import os

/// Identifier-free PLI-M2 diagnostic lines (Kotlin `PliM2Diagnostics`): closed categories only, never request ids,
/// operation references, PaymentIntent ids, reader ids, serials, cookies or secrets.
public enum KioskDiagnostics {
    private static let logger = Logger(subsystem: "com.pli.kiosk", category: "PLI-M2")
    public static let defaultSink: (String) -> Void = { line in logger.notice("\(line, privacy: .public)") }
    /// Replaceable for tests only.
    public static var sink: (String) -> Void = defaultSink

    public static func log(_ line: String) { sink(line) }
}

/// Logs bridge replies once per (operation, state) change so 500 ms polls do not flood the log, plus refusals.
public final class BridgeMessageDiagnostics {
    private let lock = NSLock()
    private var lastReply: String?

    public init() {}

    public func notAdmitted() { KioskDiagnostics.log("bridge message refused reason=not_admitted") }

    public func replied(_ response: SecureBridgeResponse, json: String?) {
        guard json != nil else { return KioskDiagnostics.log("bridge message refused reason=no_reply") }
        let line = "bridge reply op=\(response.operation ?? "nil") state=\(response.state?.rawValue ?? "nil")"
        lock.lock()
        let changed = line != lastReply
        lastReply = line
        lock.unlock()
        if changed { KioskDiagnostics.log(line) }
    }
}
