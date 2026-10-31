import XCTest
@testable import KioskNative

/// Bridge cases beyond the shared conformance vectors, plus the byte-exact reply envelope.
final class SecureBridgeTests: XCTestCase {
    func testWireStatesAndErrorsAreTheClosedKotlinSets() {
        XCTAssertEqual(SecureBridgeState.allCases.map(\.rawValue), ["accepted", "pending", "paid", "rejected"])
        XCTAssertEqual(SecureBridgeError.allCases.map(\.rawValue), [
            "REQUEST_TOO_LARGE", "MALFORMED_REQUEST", "UNSUPPORTED_VERSION", "UNKNOWN_OPERATION", "INVALID_PAYLOAD",
            "REQUEST_ID_CONFLICT", "INTERNAL_ERROR", "STALE_CONTEXT",
        ])
    }

    func testMalformedJsonNeverReachesAHandler() {
        var calls = 0
        let bridge = makeBridge(["collect": operation(["token": 10]) { calls += 1 }])
        let deep = String(repeating: "[", count: 4_000) + String(repeating: "]", count: 4_000)
        let invalid = [
            request("escape", #"{"token":"\q"}"#), request("u", #"{"token":"\u0G01"}"#), request("ctl", "{\"token\":\"a\u{01}b\"}"),
            request("lone", #"{"token":"\uD800"}"#), request("deep", "{\"token\":" + deep + "}"), request("bytes", #"{"token":"ok"}"#) + " true",
            request("nested", #"{"token":"ok"}"#, #","extra":{"nested":true,}"#),
        ]
        invalid.forEach { XCTAssertEqual(bridge.dispatch($0).error, .malformedRequest, $0.prefix(60).description) }
        XCTAssertEqual(bridge.dispatch(String(repeating: "é", count: 8_193)).error, .requestTooLarge)
        let spaced = "\r\n{\t\"version\" : 1 ,\r\n\"operation\":\"collect\",\"requestId\":\"ws\",\"payload\":{ \"token\" : \"ok\" } }\r\n"
        XCTAssertEqual(bridge.dispatch(spaced).state, .accepted)
        XCTAssertEqual(calls, 1)
    }

    func testReplayCacheKeepsOnlyDigestsAndRecentIdsStillConflictAfterEviction() {
        var calls = 0
        let bridge = makeBridge(["collect": operation(["token": 10]) { calls += 1 }]) { _, _ in "ref-\(calls)" }
        (0..<400).forEach { _ = bridge.dispatch(request("id-\($0)", #"{"token":"a"}"#)) }
        XCTAssertEqual(bridge.dispatch(request("id-399", #"{"token":"a"}"#)).operationRef, "ref-399")
        XCTAssertEqual(bridge.dispatch(request("id-399", #"{"token":"b"}"#)).error, .requestIdConflict)
        XCTAssertEqual(calls, 400)
        let responses = Mirror(reflecting: bridge).children.first { $0.label == "responses" }?.value
        let entry = responses.flatMap { Mirror(reflecting: $0).children.first?.value }.flatMap { Mirror(reflecting: $0).children.dropFirst().first?.value }
        let fields = entry.map { Mirror(reflecting: $0).children } ?? Mirror(reflecting: ()).children
        XCTAssertEqual((fields.first { $0.label == "digest" }?.value as? [UInt8])?.count, 32, "never raw request bytes")
    }

    func testTheReferenceIsGeneratedBeforeTheHandlerAndBadReferencesNeverRunIt() {
        var order = [String]()
        let bridge = SecureBridge(registry: ["collect": SecureBridgeOperation(payloadSchema: [:]) { requestId, reference, _ in
            order.append("handler:\(requestId):\(reference)")
            return SecureBridgeOperationResult(operationRef: nil, state: .rejected)
        }]) { requestId, operation in
            order.append("factory")
            return "opaque-\(requestId)-\(operation)"
        }
        XCTAssertEqual(bridge.dispatch(request("one", "{}")), SecureBridgeResponse(requestId: "one", operationRef: nil, state: .rejected, operation: "collect"))
        XCTAssertEqual(order, ["factory", "handler:one:opaque-one-collect"])
        for reference in ["", "   ", String(repeating: "r", count: 129)] {
            var handled = false
            let bad = makeBridge(["collect": operation([:]) { handled = true }]) { _, _ in reference }
            XCTAssertEqual(bad.dispatch(request("ref", "{}")).error, .internalError)
            XCTAssertFalse(handled)
        }
    }

    func testReplyJSONIsByteIdenticalToTheAndroidAdapterAndPaidOnlyForThePoll() {
        let escaped = SecureBridgeResponse(requestId: "id\"<", operationRef: "opaque-ref", state: .accepted, operation: "startPreparedPurchase")
        XCTAssertEqual(WebKitBridgeAdapter.replyJSON(escaped),
                       #"{"version":1,"operation":"startPreparedPurchase","requestId":"id\"<","payload":{"operationReference":"opaque-ref","state":"accepted"}}"#)
        let control = SecureBridgeResponse(requestId: "a\u{01}\u{08}\u{0C}\n\r\t\\é😀", operationRef: "r", state: .pending, operation: "x")
        XCTAssertEqual(WebKitBridgeAdapter.replyJSON(control),
                       "{\"version\":1,\"operation\":\"x\",\"requestId\":\"a\\u0001\\b\\f\\n\\r\\t\\\\é😀\",\"payload\":{\"operationReference\":\"r\",\"state\":\"pending\"}}")
        let poll = SecureBridgeResponse(requestId: "poll", operationRef: "opaque-start", state: .paid, operation: "getPreparedPurchaseState")
        XCTAssertEqual(WebKitBridgeAdapter.replyJSON(poll),
                       #"{"version":1,"operation":"getPreparedPurchaseState","requestId":"poll","payload":{"operationReference":"opaque-start","state":"paid"}}"#)
        XCTAssertNil(WebKitBridgeAdapter.replyJSON(SecureBridgeResponse(requestId: "s", operationRef: "r", state: .paid, operation: "startPreparedPurchase")))
        XCTAssertNil(WebKitBridgeAdapter.replyJSON(SecureBridgeResponse(requestId: "e", error: .internalError, operation: "collect")))
        XCTAssertNil(WebKitBridgeAdapter.replyJSON(SecureBridgeResponse(requestId: "n", operationRef: nil, state: .rejected, operation: "collect")))
    }

    private func operation(_ schema: [String: Int], _ handler: @escaping () throws -> Void) -> SecureBridgeOperation {
        SecureBridgeOperation(payloadSchema: schema) { _, reference, _ in
            try handler()
            return SecureBridgeOperationResult(operationRef: reference, state: .accepted)
        }
    }

    private func makeBridge(_ registry: [String: SecureBridgeOperation], reference: @escaping (String, String) throws -> String = { _, _ in "opaque" }) -> SecureBridge {
        SecureBridge(registry: registry, operationRefFactory: reference)
    }

    private func request(_ id: String, _ payload: String, _ suffix: String = "") -> String {
        "{\"version\":1,\"operation\":\"collect\",\"requestId\":\"\(id)\",\"payload\":\(payload)\(suffix)}"
    }
}
