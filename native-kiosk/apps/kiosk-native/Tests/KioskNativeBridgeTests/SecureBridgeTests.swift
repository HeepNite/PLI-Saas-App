import XCTest
@testable import KioskNativeBridge

final class SecureBridgeTests: XCTestCase {
    func testValidDispatchReturnsOnlyCoarseData() {
        var received: [String: String]?
        let bridge = makeBridge(["collect": operation(["token": 12]) { fields in
            received = fields
            return .accepted
        }]) { _, _ in "opaque-ref" }

        let response = bridge.dispatch(request("one", "collect", #"{"token":"abc"}"#))

        XCTAssertEqual(response, SecureBridgeResponse(requestId: "one", operationRef: "opaque-ref", state: .accepted))
        XCTAssertEqual(received, ["token": "abc"])
    }

    func testRejectsOversizeMalformedMissingExtraAndWrongEnvelopeTypes() {
        let bridge = makeBridge()
        let invalid = [
            "not-json", "{}", request("escape", "collect", #"{"token":"\q"}"#),
            request("unicode-plus", "collect", #"{"token":"\u+001"}"#),
            request("unicode-non-hex", "collect", #"{"token":"\u0G01"}"#),
            request("unicode-truncated", "collect", #"{"token":"\u001"}"#),
            request("unicode-surrogate", "collect", #"{"token":"\uD800"}"#),
            request("one", "collect", "{}", ",\"extra\":true"),
            request("one", "collect", "{}").replacingOccurrences(of: #""payload":{}"#, with: #""payload":[]"#),
            request("one", "collect", "{}").replacingOccurrences(of: #""version":1"#, with: #""version":"1"#),
            request("one", "collect", "{}").replacingOccurrences(of: #""operation":"collect""#, with: #""operation":1"#),
        ]

        invalid.forEach { XCTAssertEqual(bridge.dispatch($0).error, .malformedRequest) }
        XCTAssertEqual(bridge.dispatch(String(repeating: "é", count: 8_193)).error, .requestTooLarge)
    }

    func testRejectsDuplicateKeysTrailingCommasTrailingBytesAndDeepNonStrings() {
        var calls = 0
        let bridge = makeBridge(["collect": operation(["token": 10]) { _ in calls += 1; return .accepted }])
        let deep = String(repeating: "[", count: 4_000) + String(repeating: "]", count: 4_000)
        let invalid = [
            #"{"version":1,"operation":"collect","operation":"collect","requestId":"one","payload":{"token":"ok"}}"#,
            #"{"version":1,"operation":"collect","requestId":"one","payload":{"token":"ok","token":"ok"}}"#,
            request("one", "collect", #"{"token":"ok",}"#), request("two", "collect", #"{"token":"ok"}"#, ","),
            request("three", "collect", #"{"token":"ok"}"#) + " true",
            request("deep", "collect", "{\"token\":" + deep + "}"),
        ]

        invalid.forEach { XCTAssertEqual(bridge.dispatch($0).error, .malformedRequest) }
        XCTAssertEqual(calls, 0)
    }

    func testRejectsUnknownVersionOperationAndClosedPayloadSchemas() {
        var calls = 0
        let bridge = makeBridge(["collect": operation(["token": 3]) { _ in calls += 1; return .accepted }])

        ["2", "1.0"].forEach {
            XCTAssertEqual(bridge.dispatch(request("version-\($0)", "collect", "{}").replacingOccurrences(of: #""version":1"#, with: "\"version\":\($0)")).error, .unsupportedVersion)
        }
        XCTAssertEqual(bridge.dispatch(request("unknown", "missing", "{}")).error, .unknownOperation)
        ["{}", #"{"token":"ok","extra":"x"}"#, #"{"token":"long"}"#].enumerated().forEach {
            XCTAssertEqual(bridge.dispatch(request("schema-\($0.offset)", "collect", $0.element)).error, .invalidPayload)
        }
        XCTAssertEqual(bridge.dispatch(request("number", "collect", #"{"token":1}"#)).error, .malformedRequest)
        XCTAssertEqual(calls, 0)
    }

    func testDuplicateReplayConflictsAndRedactsFailures() {
        var calls = 0
        let bridge = makeBridge(["collect": operation(["token": 10]) { _ in calls += 1; return .pending }]) { _, _ in "ref-\(calls)" }
        let first = bridge.dispatch(request("same", "collect", #"{"token":"a"}"#))

        XCTAssertEqual(bridge.dispatch(request("same", "collect", #"{"token":"a"}"#)), first)
        XCTAssertEqual(bridge.dispatch(request("same", "collect", #"{"token":"b"}"#)).error, .requestIdConflict)
        XCTAssertEqual(first.operationRef, "ref-1")
        XCTAssertEqual(calls, 1)

        let handlerFailure = makeBridge(["collect": operation([:]) { _ in throw TestError.failure }])
        XCTAssertEqual(handlerFailure.dispatch(request("handler", "collect", "{}")).error, .internalError)
        let factoryFailure = makeBridge(["collect": operation([:]) { _ in .accepted }]) { _, _ in throw TestError.failure }
        XCTAssertEqual(factoryFailure.dispatch(request("factory", "collect", "{}")).error, .internalError)
    }

    func testCacheCapacityClosesPermanentlyAndInvalidationClearsContext() {
        var calls = 0
        let bridge = makeBridge(["collect": operation([:]) { _ in calls += 1; return .accepted }])
        (0..<256).forEach { XCTAssertEqual(bridge.dispatch(request("id-\($0)", "collect", "{}")).state, .accepted) }
        XCTAssertEqual(bridge.dispatch(request("id-0", "collect", "{}")).state, .accepted)
        XCTAssertEqual(bridge.dispatch(request("overflow", "collect", "{}")).error, .responseCacheExhausted)
        XCTAssertEqual(bridge.dispatch(request("later", "collect", "{}")).error, .staleContext)
        XCTAssertEqual(calls, 256)

        let invalidated = makeBridge(["collect": operation([:]) { _ in .accepted }])
        XCTAssertEqual(invalidated.dispatch(request("one", "collect", "{}")).state, .accepted)
        invalidated.invalidate()
        let response = invalidated.dispatch(request("one", "collect", "{}"))
        XCTAssertEqual(response.error, .staleContext)
        XCTAssertNil(response.requestId)
        XCTAssertNil(response.operationRef)
        XCTAssertNil(response.state)
    }

    private enum TestError: Error { case failure }
    private func operation(_ schema: [String: Int], _ handler: @escaping ([String: String]) throws -> SecureBridgeState) -> SecureBridgeOperation {
        SecureBridgeOperation(payloadSchema: schema, handler: handler)
    }
    private func makeBridge(_ registry: [String: SecureBridgeOperation] = [:], reference: @escaping (String, String) throws -> String = { _, _ in "opaque" }) -> SecureBridge {
        SecureBridge(registry: registry, operationRefFactory: reference)
    }
    private func request(_ id: String, _ operation: String, _ payload: String, _ suffix: String = "") -> String {
        "{\"version\":1,\"operation\":\"\(operation)\",\"requestId\":\"\(id)\",\"payload\":\(payload)\(suffix)}"
    }
}
