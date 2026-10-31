import UIKit
import WebKit
import KioskNative

/// Full-screen WKWebView host for the staff terminal. Thin UIKit/WebKit glue: the decisions (exact-origin navigation
/// lock, session-gated bridge, message admission) live in the unit-tested `OriginPolicy` and `KioskBridgeHost`.
/// No Guided Access, supervision or other OS lockdown API is used.
final class KioskViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private static let handlerName = "pliNative"

    private let configuration = KioskConfiguration(info: Bundle.main.infoDictionary ?? [:])
    private let bluetooth = CoreBluetoothPermissions()
    private let store = KeychainStore()
    private let clock: () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
    private let execute: Execute = { [queue = DispatchQueue(label: "pli.kiosk.network", qos: .userInitiated)] in queue.async(execute: $0) }
    /// Only with valid reader pins; without them the app is a plain web kiosk (no shim, no bridge).
    private lazy var coordinator = configuration.flatMap { configuration in
        configuration.readerPolicy.map {
            PurchaseCoordinator(
                origin: configuration.originPolicy.origin, locationId: $0.locationId, store: store,
                server: PurchaseServer(origin: configuration.originPolicy.origin, http: URLSessionHTTPClient()), clock: clock,
                currentCookie: { [weak self] in self?.sessionCookie() }, execute: execute
            )
        }
    }
    private var webView: WKWebView?
    private var host: KioskBridgeHost?
    private var pushTarget: WebPushTarget?
    private var observers = [NSObjectProtocol]()
    private let cookieLock = NSLock()
    private var cookieSnapshot: String?

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.becameActive() },
            center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { _ in UIApplication.shared.isIdleTimerDisabled = false },
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.host?.invalidate() },
        ]
        bluetooth.onResult = { [weak self] granted in self?.host?.onBluetoothPermissionResult(granted) }
        KioskDiagnostics.log("startup configuration origin_ok=\(configuration != nil) pins_ok=\(configuration?.readerPolicy != nil) coordinator=\(coordinator != nil)")
        startSession()
    }

    deinit { observers.forEach(NotificationCenter.default.removeObserver) }

    /// A kiosk never sleeps while foreground; a backgrounded (invalidated) host gets a fresh web view.
    private func becameActive() {
        UIApplication.shared.isIdleTimerDisabled = true
        if host?.isInvalidated == true { startSession() }
    }

    private func startSession() {
        tearDown()
        guard let configuration else { return }
        let web = WKWebView(frame: view.bounds, configuration: webConfiguration())
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.navigationDelegate = self
        web.uiDelegate = self
        web.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(web)
        webView = web
        pushTarget = WebPushTarget(webView: web)
        host = makeHost(configuration)
        KioskDiagnostics.log("session started host=\(host != nil)")
        if let url = URL(string: configuration.originPolicy.terminalURL) { web.load(URLRequest(url: url)) }
    }

    private func webConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "PLINativeKiosk/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0")"
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        guard coordinator != nil else { return configuration } // no reader pins: plain web kiosk
        // The shim runs at every document start; messages stay unanswered until the host has a bridge.
        configuration.userContentController.addUserScript(WKUserScript(source: BridgeShim.script(handlerName: Self.handlerName), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.add(self, contentWorld: .page, name: Self.handlerName)
        KioskDiagnostics.log("bridge shim installed")
        return configuration
    }

    private func makeHost(_ configuration: KioskConfiguration) -> KioskBridgeHost? {
        guard let coordinator, let readerPolicy = configuration.readerPolicy else { return nil }
        return KioskBridgeHost(
            policy: configuration.originPolicy,
            // A retained attempt cleared by startup recovery: rebuild the web view for a fresh capture.
            capture: { coordinator.capture { [weak self] in DispatchQueue.main.async { self?.startSession() } } },
            reload: { [weak self] in self?.webView?.reload() },
            makeContext: { [store, bluetooth, clock, execute] in
                KioskContext(
                    coordinator: coordinator, policy: readerPolicy, store: store, sdk: LiveTerminalSDKClient.shared,
                    permissions: bluetooth, scheduler: DispatchDeadlineScheduler(), clock: clock, execute: execute
                )
            }
        )
    }

    private func tearDown() {
        host?.invalidate()
        host = nil
        pushTarget?.invalidate()
        pushTarget = nil
        guard let webView else { return }
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Self.handlerName, contentWorld: .page)
        webView.configuration.userContentController.removeAllUserScripts()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.removeFromSuperview()
        self.webView = nil
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let target = navigationAction.targetFrame, let policy = configuration?.originPolicy else { return decisionHandler(.cancel) } // popups
        decisionHandler(policy.shouldCancelNavigation(navigationAction.request.url?.absoluteString, isMainFrame: target.isMainFrame) ? .cancel : .allow)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        host?.documentStarted()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshCookieSnapshot { [weak self, weak webView] in
            guard let self, let webView, webView === self.webView else { return }
            self.host?.pageFinished(webView.url?.absoluteString)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        startSession()
    }

    // MARK: WKUIDelegate

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }

    // MARK: WKScriptMessageHandler (no reply; replies are pushed back as strings)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let host, let pushTarget else { return }
        let origin = message.frameInfo.securityOrigin
        host.receive(
            message.body, sourceOrigin: OriginPolicy.serializedOrigin(scheme: origin.protocol, host: origin.host, port: origin.port),
            isMainFrame: message.frameInfo.isMainFrame, currentURL: webView?.url?.absoluteString, target: pushTarget, reply: pushTarget.deliver
        )
    }

    // MARK: Session cookie (native only; never reaches JavaScript)

    /// On the main thread the snapshot taken at page finish; off it (sale admission) a fresh read, bounded to 2 s.
    private func sessionCookie() -> String? {
        if !Thread.isMainThread {
            let done = DispatchSemaphore(value: 0)
            DispatchQueue.main.async { [weak self] in
                guard let self else { _ = done.signal(); return }
                self.refreshCookieSnapshot { _ = done.signal() }
            }
            _ = done.wait(timeout: .now() + 2)
        }
        cookieLock.lock()
        defer { cookieLock.unlock() }
        return cookieSnapshot
    }

    private func refreshCookieSnapshot(_ done: @escaping () -> Void) {
        guard let origin = configuration?.originPolicy.origin, let store = webView?.configuration.websiteDataStore.httpCookieStore else { return done() }
        store.getAllCookies { [weak self] cookies in
            let value = StaffSession.cookieValue(in: cookies, origin: origin)
            self?.cookieLock.lock()
            self?.cookieSnapshot = value
            self?.cookieLock.unlock()
            DispatchQueue.main.async(execute: done)
        }
    }
}
