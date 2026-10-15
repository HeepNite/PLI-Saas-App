import XCTest
@testable import KioskNativeBridge

final class WebKitBridgeAdapterTests: XCTestCase {
    func testApprovedOriginAllowsOnlyDefaultHTTPSRootOrigin() {
        XCTAssertNotNil(WebKitBridgeOrigin(configuredOrigin: "https://Kiosk.Example"))
        [
            "http://kiosk.example", "https://user@kiosk.example", "https://kiosk.example:443",
            "https://kiosk.example/path", "https://kiosk.example?query=1", "https://kiosk.example?",
            "https://kiosk.example#fragment", "https://kiosk.example#",
        ].forEach { XCTAssertNil(WebKitBridgeOrigin(configuredOrigin: $0), $0) }
    }

    func testGateRequiresMainFrameAndExactCanonicalOrigin() {
        let adapter = makeAdapter()
        XCTAssertTrue(adapter.accepts(frame: frame(host: "KIOSK.EXAMPLE")))
        XCTAssertTrue(adapter.accepts(frame: frame(port: 443)))
        [
            frame(scheme: "http"), frame(host: "other.example"), frame(port: 8443),
            frame(host: nil), frame(isMainFrame: false),
        ].forEach { XCTAssertFalse(adapter.accepts(frame: $0)) }
    }

    func testOnlyRawJSONStringsReachSecureBridge() {
        var calls = 0
        let adapter = makeAdapter(operation: { _ in calls += 1; return .accepted })
        let valid = request("one")

        XCTAssertEqual(adapter.receive(body: valid, frame: frame())["state"], "accepted")
        [[:], ["request": "one"], [valid], 1].forEach {
            XCTAssertEqual(adapter.receive(body: $0, frame: frame()), [:])
        }
        XCTAssertEqual(calls, 1)
    }

    func testReplyProjectionContainsOnlyCoarseResponseFields() {
        let response = SecureBridgeResponse(requestId: "one", operationRef: "opaque", state: .pending, error: .internalError)
        let reply = WebKitBridgeAdapter.project(response)

        XCTAssertEqual(reply, ["requestId": "one", "operationRef": "opaque", "state": "pending", "error": "internalError"])
        XCTAssertEqual(Set(reply.keys), ["requestId", "operationRef", "state", "error"])
    }

    func testInvalidationUnregistersFixedHandlerAndClosesCore() {
        let adapter = makeAdapter()
        let registration = FakeRegistration()
        adapter.register(using: registration)
        adapter.invalidate(using: registration)
        adapter.register(using: registration)

        XCTAssertEqual(registration.added, [WebKitBridgeAdapter.handlerName])
        XCTAssertEqual(registration.removed, [WebKitBridgeAdapter.handlerName])
        XCTAssertEqual(adapter.receive(body: request("late"), frame: frame())["error"], "staleContext")
    }

    private func makeAdapter(operation: @escaping ([String: String]) throws -> SecureBridgeState = { _ in .accepted }) -> WebKitBridgeAdapter {
        let bridge = SecureBridge(
            registry: ["collect": SecureBridgeOperation(payloadSchema: [:], handler: operation)],
            operationRefFactory: { _, _ in "opaque" }
        )
        return WebKitBridgeAdapter(approvedOrigin: "https://kiosk.example", bridge: bridge)!
    }

    private func frame(scheme: String? = "https", host: String? = "kiosk.example", port: Int? = 0, isMainFrame: Bool = true) -> WebKitBridgeFrameContext {
        WebKitBridgeFrameContext(scheme: scheme, host: host, port: port, isMainFrame: isMainFrame)
    }

    private func request(_ id: String) -> String {
        #"{"version":1,"operation":"collect","requestId":"\#(id)","payload":{}}"#
    }
}

private final class FakeRegistration: WebKitBridgeHandlerRegistration {
    var added = [String]()
    var removed = [String]()

    func addPageHandler(_ handler: WebKitBridgeAdapter, named name: String) { added.append(name) }
    func removePageHandler(named name: String) { removed.append(name) }
}
