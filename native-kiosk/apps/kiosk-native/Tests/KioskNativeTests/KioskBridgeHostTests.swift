import XCTest
@testable import KioskNative

/// End to end through the host, the closed bridge, the real coordinator, owner and sale, with fake SDK and server.
final class KioskBridgeHostTests: XCTestCase {
    private let policy = OriginPolicy(approvedOrigin: Fixtures.origin)!
    private let world = World()
    private let sdk = FakeSDK()
    private let scheduler = FakeScheduler()
    private var posted = [String]()
    private var contexts = 0
    private var references = 0
    private var reloads = 0
    private lazy var target = ClosureWebEventTarget { [unowned self] in posted.append($0) }
    private let learned = SDKReader(stripeId: "tmr_new", serialNumber: Fixtures.serial, deviceType: "stripe_m2", locationId: Fixtures.location)

    private func makeHost() -> KioskBridgeHost {
        KioskBridgeHost(policy: policy, capture: { [unowned self] in world.coordinator.capture {} }, reload: { [unowned self] in reloads += 1 }, makeContext: { [unowned self] in
            contexts += 1
            return KioskContext(
                coordinator: world.coordinator, policy: Fixtures.policy, store: world.store, sdk: sdk, permissions: FakePermissions(granted: true),
                scheduler: scheduler, clock: { [unowned self] in scheduler.now }, execute: { $0() }, newReference: { self.references += 1; return "op-\(self.references)" }
            )
        })
    }

    private func message(_ operation: String, _ payload: String = "{}", id: String = "r1") -> String {
        #"{"version":1,"operation":"\#(operation)","requestId":"\#(id)","payload":\#(payload)}"#
    }

    @discardableResult
    private func receive(_ host: KioskBridgeHost, _ body: Any, origin: String? = Fixtures.origin, mainFrame: Bool = true, url: String? = nil) -> String? {
        var reply: String?
        host.receive(body, sourceOrigin: origin, isMainFrame: mainFrame, currentURL: url ?? policy.terminalURL, target: target) { reply = $0 }
        return reply
    }

    private func start(_ host: KioskBridgeHost, id: String = "s1") -> String? {
        receive(host, message("startPreparedPurchase", #"{"preparedPurchaseReference":"\#(Fixtures.reference)"}"#, id: id))
    }

    func testNoBridgeBeforeTheExactTerminalPageLoadedWithACapturedSession() {
        let host = makeHost()
        XCTAssertNil(receive(host, message("diagnosticRoundTrip")))
        host.pageFinished(Fixtures.origin + "/staff/other")
        world.cookie = nil
        host.pageFinished(policy.terminalURL)
        XCTAssertEqual(contexts, 0)
        world.cookie = "cookie"
        host.pageFinished(policy.terminalURL)
        host.pageFinished(policy.terminalURL)
        XCTAssertEqual(contexts, 1, "one bridge per web view; reloads keep it")
        XCTAssertEqual(sdk.discoveries, 1, "the warm reader starts with the bridge")
    }

    func testAPageRefusedBeforeTheBridgeExistedIsReloadedOnceSoItAsksAgain() {
        let host = makeHost()
        host.pageFinished(policy.terminalURL)
        XCTAssertEqual(reloads, 0, "a page that never spoke early needs no reload")

        let early = makeHost()
        XCTAssertNil(receive(early, message("getReaderStatus")))
        early.pageFinished(policy.terminalURL)
        XCTAssertEqual(reloads, 1, "the early refused request is re-sent by the reloaded page")
        early.documentStarted()
        early.pageFinished(policy.terminalURL)
        XCTAssertNotNil(receive(early, message("getReaderStatus")))
        early.pageFinished(policy.terminalURL)
        XCTAssertEqual(reloads, 1, "at most one reload per web view")
        XCTAssertEqual(posted, [#"{"version":1,"event":"readerStatus","payload":{"status":"connecting"}}"#])
    }

    func testOnlyStringMessagesFromTheApprovedMainFrameOnTheTerminalPageAreAnswered() throws {
        let host = makeHost()
        host.pageFinished(policy.terminalURL)
        XCTAssertNil(receive(host, message("diagnosticRoundTrip"), origin: "https://evil.example"))
        XCTAssertNil(receive(host, message("diagnosticRoundTrip"), mainFrame: false))
        XCTAssertNil(receive(host, message("diagnosticRoundTrip"), url: Fixtures.origin + "/other"))
        XCTAssertNil(receive(host, ["not": "a string"]))
        XCTAssertNil(receive(host, message("startPurchase", id: "u1")), "unknown operations get no reply")
        XCTAssertTrue(try XCTUnwrap(receive(host, message("diagnosticRoundTrip"))).contains(#""state":"accepted""#))
    }

    func testReaderStatusIsPushedOnlyToTheBoundPageAndANewDocumentUnbindsIt() {
        let host = makeHost()
        host.pageFinished(policy.terminalURL)
        XCTAssertTrue(posted.isEmpty, "nothing is pushed before the page speaks")
        receive(host, message("getReaderStatus"))
        XCTAssertEqual(posted, [#"{"version":1,"event":"readerStatus","payload":{"status":"connecting"}}"#])
        host.documentStarted()
        sdk.publish(Fixtures.exact)
        sdk.completeConnection(Fixtures.exact)
        XCTAssertEqual(posted.count, 1)
    }

    func testFirstPairingThenASaleReportsPaidOnlyFromTheServerAndTheCookieNeverReachesThePage() throws {
        let host = makeHost()
        host.pageFinished(policy.terminalURL)
        XCTAssertTrue(try XCTUnwrap(start(host, id: "early")).contains(#""state":"rejected""#), "no sale before the reader is ready")
        sdk.publish(learned)
        sdk.completeConnection(learned)
        XCTAssertEqual(world.store.readPairedReaderId(), "tmr_new")
        XCTAssertEqual(try sdk.token(), "tok")
        world.http.responses["prepared-attempt"] = #"{"ticket":"t","expiresAt":100000000,"readerId":"tmr_new","locationId":"\#(Fixtures.location)"}"#

        let reply = try XCTUnwrap(start(host))
        XCTAssertEqual(reply, #"{"version":1,"operation":"startPreparedPurchase","requestId":"s1","payload":{"operationReference":"op-2","state":"pending"}}"#)
        sdk.retrieved("pi_1")
        sdk.collected("pi_1")
        world.http.responses["prepared-recover"] = FakeServer.payment("succeeded")
        sdk.confirmed("pi_1")
        let poll = try XCTUnwrap(receive(host, message("getPreparedPurchaseState", #"{"operationReference":"op-2"}"#, id: "p1")))
        XCTAssertTrue(poll.contains(#""state":"paid""#))
        XCTAssertFalse((posted + [reply, poll]).joined().contains("cookie"))
        XCTAssertFalse((posted + [reply, poll]).joined().contains("pi_1"))
    }

    func testANewDocumentAbandonsItsSaleAndInvalidationIsFinal() throws {
        try world.store.writePairedReaderId(Fixtures.readerId)
        let host = makeHost()
        host.pageFinished(policy.terminalURL)
        sdk.publish(Fixtures.exact)
        sdk.completeConnection(Fixtures.exact)
        start(host)
        sdk.retrieved("pi_1")
        host.documentStarted()
        XCTAssertEqual(sdk.cancelledOperations, ["collect"])
        XCTAssertNotNil(receive(host, message("diagnosticRoundTrip", id: "r2")), "the bridge survives a new document")
        host.invalidate()
        XCTAssertTrue(host.isInvalidated)
        XCTAssertEqual(sdk.disconnects, 1)
        host.pageFinished(policy.terminalURL)
        XCTAssertEqual(contexts, 1)
        XCTAssertNil(receive(host, message("diagnosticRoundTrip", id: "r3")))
    }
}
