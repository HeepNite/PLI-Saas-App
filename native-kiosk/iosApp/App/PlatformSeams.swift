import CoreBluetooth
import Foundation
import KioskNative
import WebKit

/// Main-queue scheduler for retries and deadlines.
final class DispatchDeadlineScheduler: DeadlineScheduler {
    func schedule(delayMs: Int64, _ task: @escaping () -> Void) -> TerminalCancelable {
        let item = DispatchWorkItem(block: task)
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int(delayMs)), execute: item)
        return TerminalCancelable { item.cancel() }
    }
}

/// CoreBluetooth authorization. Requesting only creates a central manager so iOS shows its prompt; it never scans.
final class CoreBluetoothPermissions: NSObject, BluetoothPermissions, CBCentralManagerDelegate {
    var onResult: ((Bool) -> Void)?
    private var manager: CBCentralManager?

    func hasBluetoothPermissions() -> Bool { CBCentralManager.authorization == .allowedAlways }

    func requestBluetoothPermissions() throws {
        guard manager == nil else { return }
        manager = CBCentralManager(delegate: self, queue: .main, options: [CBCentralManagerOptionShowPowerAlertKey: false])
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let authorization = CBCentralManager.authorization
        if authorization != .notDetermined { onResult?(authorization == .allowedAlways) }
    }
}

/// Pushes replies and events into the page through `evaluateJavaScript` (BridgeShim delivery script) on the main
/// thread; nothing is delivered once the web view is torn down. Events are logged, replies are logged at dispatch.
final class WebPushTarget: NativeWebEventTarget {
    private weak var webView: WKWebView?
    private var valid = true

    init(webView: WKWebView) { self.webView = webView }

    func post(_ message: String) throws {
        DispatchQueue.main.async { [weak self] in self?.deliver(message, isEvent: true) }
    }

    func deliver(_ message: String) { deliver(message, isEvent: false) }

    func invalidate() { valid = false }

    private func deliver(_ message: String, isEvent: Bool) {
        guard valid, let webView else { return isEvent ? KioskDiagnostics.log("event dropped reason=\(valid ? "unbound" : "invalidated")") : () }
        webView.evaluateJavaScript(BridgeShim.deliveryScript(message: message), completionHandler: nil)
        if isEvent { KioskDiagnostics.log("event delivered") }
    }
}
