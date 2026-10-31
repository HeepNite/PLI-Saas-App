import Foundation

/// One web view's native world: the closed bridge, the push channel, the sale and the warm reader.
public final class KioskContext {
    public let bridge: SecureBridge
    public let events: NativeWebEvents
    public let sale: SaleController
    public let reader: ReaderConnectionOwner

    public init(
        coordinator: PurchaseCoordinator, policy: ReaderPolicy, store: KeychainStore, sdk: TerminalSDKClient,
        permissions: BluetoothPermissions, scheduler: DeadlineScheduler, clock: @escaping () -> Int64, execute: @escaping Execute,
        newReference: @escaping () -> String = KioskContext.newOperationReference
    ) {
        let events = NativeWebEvents()
        let reader = ReaderConnectionOwner(
            sdk: sdk, permissions: permissions, policy: policy, pinnedReaderId: store.readPairedReaderId(), scheduler: scheduler,
            events: events, fetchToken: coordinator.connectionToken, execute: execute,
            onPaired: { try? store.writePairedReaderId($0) } // first pairing survives restarts
        )
        let sale = SaleController(
            coordinator: coordinator, sdk: sdk, readyReaderId: reader.readyReaderId, scheduler: scheduler,
            execute: execute, clock: clock, onPrompt: { events.collectionPrompt($0) }
        )
        self.events = events
        self.reader = reader
        self.sale = sale
        bridge = SecureBridge(registry: sale.registry(events: events)) { _, _ in newReference() }
    }

    func invalidate() {
        sale.invalidate()
        bridge.invalidate()
        events.invalidate()
        reader.invalidate()
    }

    /// Request-independent, 32-byte URL-safe opaque reference (43 base64url characters, no padding).
    public static func newOperationReference() -> String {
        var generator = SystemRandomNumberGenerator()
        let bytes = (0..<32).map { _ in UInt8.random(in: .min ... .max, using: &generator) }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

/// The native side of one web view. The document-start shim and the message handler are always installed, but no
/// bridge exists until the exact terminal page loaded and its staff session was captured (startup recovery of a
/// retained attempt runs inside that capture). Messages are answered only from the approved origin's main frame on
/// the terminal page. A new document unbinds the push channel and abandons its sale but keeps the bridge;
/// invalidation is final (the app builds a fresh web view). Main thread only.
public final class KioskBridgeHost {
    private let policy: OriginPolicy
    private let capture: () -> Bool
    private let reload: () -> Void
    private let makeContext: () -> KioskContext
    private let diagnostics = BridgeMessageDiagnostics()
    private var boundTarget: NativeWebEventTarget?
    private var refusedBeforeContext = false

    public private(set) var context: KioskContext?
    public private(set) var isInvalidated = false

    /// `reload` reloads the web view; it runs at most once, when the page spoke before its bridge existed.
    public init(policy: OriginPolicy, capture: @escaping () -> Bool, reload: @escaping () -> Void = {}, makeContext: @escaping () -> KioskContext) {
        self.policy = policy
        self.capture = capture
        self.reload = reload
        self.makeContext = makeContext
    }

    /// The main frame finished loading `url` (the app refreshed its native cookie snapshot first).
    public func pageFinished(_ url: String?) {
        guard !isInvalidated, context == nil else { return }
        guard url == policy.terminalURL else { return KioskDiagnostics.log("page finished terminal=no") }
        let captured = capture()
        KioskDiagnostics.log("page finished terminal=yes session_captured=\(captured ? "yes" : "no")")
        guard captured else { return }
        let created = makeContext()
        context = created
        KioskDiagnostics.log("native context created; reader owner start")
        created.reader.start()
        // The page asked (getReaderStatus) before the bridge existed and never asks again: one reload lets it re-ask.
        // The context exists from here on, so this guard cannot loop.
        guard refusedBeforeContext else { return }
        refusedBeforeContext = false
        KioskDiagnostics.log("page reload after early refused message")
        reload()
    }

    /// One script message. The reply goes back through `reply`; the sender becomes the event push target.
    public func receive(_ body: Any, sourceOrigin: String?, isMainFrame: Bool, currentURL: String?, target: NativeWebEventTarget, reply: (String) -> Void) {
        KioskDiagnostics.log("bridge message received context=\(context != nil ? "yes" : "no")")
        if context == nil { refusedBeforeContext = true }
        guard let body = body as? String, let context,
              policy.acceptsMessage(sourceOrigin: sourceOrigin, isMainFrame: isMainFrame, currentURL: currentURL) else {
            return diagnostics.notAdmitted()
        }
        let response = context.bridge.dispatch(body)
        let json = WebKitBridgeAdapter.replyJSON(response)
        diagnostics.replied(response, json: json)
        if let json { reply(json) }
        // Only an admitted message binds the push target (nothing is pushed before the page speaks).
        boundTarget = target
        context.events.bind(target)
    }

    /// A main-frame navigation started: the previous document can no longer watch its sale.
    public func documentStarted() {
        if let boundTarget { context?.events.unbind(boundTarget) }
        boundTarget = nil
        context?.sale.documentRetired()
    }

    public func onBluetoothPermissionResult(_ granted: Bool) { context?.reader.onBluetoothPermissionResult(granted) }

    public func invalidate() {
        guard !isInvalidated else { return }
        isInvalidated = true
        context?.invalidate()
        context = nil
        boundTarget = nil
    }
}
