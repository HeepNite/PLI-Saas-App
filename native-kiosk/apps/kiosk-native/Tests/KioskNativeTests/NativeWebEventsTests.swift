import XCTest
@testable import KioskNative

/// Push events (exact strings the web parser accepts) and the identifier-free diagnostic lines.
final class NativeWebEventsTests: XCTestCase {
    private let events = NativeWebEvents()
    private var posted = [String]()
    private var lines = [String]()
    private lazy var page = ClosureWebEventTarget { [unowned self] in posted.append($0) }

    override func setUp() { KioskDiagnostics.sink = { [unowned self] in lines.append($0) } }
    override func tearDown() { KioskDiagnostics.sink = KioskDiagnostics.defaultSink }

    private func status(_ value: String) -> String { #"{"version":1,"event":"readerStatus","payload":{"status":"\#(value)"}}"# }
    private func prompt(_ value: String) -> String { #"{"version":1,"event":"collectionPrompt","payload":{"prompt":"\#(value)"}}"# }

    func testOnlyTheClosedEventsArePushedOnChangeToABoundPage() {
        XCTAssertEqual(NativeReaderStatus.allCases.map(\.rawValue), ["connected", "connecting", "disconnected"])
        XCTAssertEqual(CollectionPrompt.allCases.map(\.rawValue), ["none", "awaiting_card", "processing"])
        events.readerStatus(.connecting)
        events.bind(page)
        [NativeReaderStatus.connecting, .connected, .connected].forEach(events.readerStatus)
        [CollectionPrompt.awaitingCard, .awaitingCard, .processing, .none].forEach(events.collectionPrompt)
        XCTAssertEqual(posted, [status("connected"), prompt("awaiting_card"), prompt("processing"), prompt("none")])
        XCTAssertEqual(lines.prefix(3), [
            "event pushed type=readerStatus value=connecting bound=false",
            "event pushed type=readerStatus value=connected bound=true",
            "event pushed type=collectionPrompt value=awaiting_card bound=true",
        ])
        XCTAssertTrue(lines.contains("event skipped type=collectionPrompt value=awaiting_card reason=unchanged"))
    }

    func testAStatusRequestIsAnsweredOnceAtTheNextBindAndOnlyWithAKnownStatus() {
        events.requestStatus()
        events.bind(page)
        XCTAssertTrue(posted.isEmpty)
        events.unbind(page)
        events.readerStatus(.connected)
        events.requestStatus()
        events.bind(page)
        events.bind(page)
        XCTAssertEqual(posted, [status("connected")])
    }

    func testUnbindClearsOnlyThatBindingAndInvalidationSilencesEverything() {
        var older = [String]()
        events.bind(ClosureWebEventTarget { older.append($0) })
        events.bind(page)
        events.unbind(ClosureWebEventTarget { _ in })
        events.readerStatus(.connected)
        events.invalidate()
        events.readerStatus(.disconnected)
        events.bind(page)
        XCTAssertTrue(older.isEmpty)
        XCTAssertEqual(posted, [status("connected")])
    }

    func testAFailingPageNeverBreaksTheNativeCaller() {
        events.bind(ClosureWebEventTarget { _ in throw FakeFailure() })
        events.readerStatus(.connected)
        events.collectionPrompt(.processing)
    }

    func testBridgeRepliesLogOneLinePerOperationStateChangeAndRefusals() {
        let diagnostics = BridgeMessageDiagnostics()
        let pending = SecureBridgeResponse(requestId: "req-secret", operationRef: "ref-secret", state: .pending, operation: "getPreparedPurchaseState")
        diagnostics.notAdmitted()
        diagnostics.replied(pending, json: "{}")
        diagnostics.replied(pending, json: "{}")
        diagnostics.replied(SecureBridgeResponse(requestId: "r", error: .malformedRequest), json: nil)
        XCTAssertEqual(lines, [
            "bridge message refused reason=not_admitted",
            "bridge reply op=getPreparedPurchaseState state=pending",
            "bridge message refused reason=no_reply",
        ])
        XCTAssertFalse(lines.joined().contains("secret"))
    }
}
