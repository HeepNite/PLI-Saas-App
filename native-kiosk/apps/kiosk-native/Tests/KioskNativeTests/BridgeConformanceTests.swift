import XCTest
@testable import KioskNative

/// Replays native-kiosk/conformance/bridge-vectors.json, derived from the Kotlin SecureWebBridgeTest
/// cases, against the Swift bridge so both platforms keep one wire contract.
final class BridgeConformanceTests: XCTestCase {
    func testEveryVectorCaseMatchesTheKotlinContract() throws {
        let file = try Vectors.load()
        XCTAssertEqual(file.version, 1)
        XCTAssertGreaterThanOrEqual(file.cases.count, 10)
        for vector in file.cases { run(vector) }
    }

    private func run(_ vector: Vectors.Case) {
        var calls = 0
        var registry = [String: SecureBridgeOperation]()
        for (name, config) in vector.operations {
            registry[name] = SecureBridgeOperation(payloadSchema: config.schema) { _, reference, _ in
                calls += 1
                if config.result == "throw" { throw VectorError.handler }
                return SecureBridgeOperationResult(operationRef: reference, state: SecureBridgeState(rawValue: config.result)!)
            }
        }
        let bridge = SecureBridge(registry: registry) { _, _ in "opaque" }
        for (index, step) in vector.steps.enumerated() {
            let label = "\(vector.name)#\(index)"
            if step.invalidate == true { bridge.invalidate(); continue }
            for (raw, id) in step.rawRequests() {
                let expected = step.range == nil ? step.expect!.response : step.expect!.response.with(requestId: id)
                XCTAssertEqual(bridge.dispatch(raw), expected, label)
            }
        }
        XCTAssertEqual(calls, vector.handlerCalls, vector.name)
    }

    private enum VectorError: Error { case handler }
}

private struct Vectors: Decodable {
    let version: Int
    let cases: [Case]

    static func load(file: String = #filePath) throws -> Vectors {
        var url = URL(fileURLWithPath: file)
        for _ in 0..<5 { url.deleteLastPathComponent() }
        let data = try Data(contentsOf: url.appendingPathComponent("conformance/bridge-vectors.json"))
        return try JSONDecoder().decode(Vectors.self, from: data)
    }

    struct Case: Decodable {
        let name: String
        let operations: [String: Operation]
        let steps: [Step]
        let handlerCalls: Int
    }

    struct Operation: Decodable {
        let schema: [String: Int]
        let result: String
    }

    struct Expect: Decodable {
        let requestId: String?
        let operationRef: String?
        let state: String?
        let error: String?
        let operation: String?

        var response: SecureBridgeResponse {
            SecureBridgeResponse(
                requestId: requestId, operationRef: operationRef,
                state: state.flatMap(SecureBridgeState.init(rawValue:)),
                error: error.flatMap(SecureBridgeError.init(rawValue:)),
                operation: operation
            )
        }
    }

    /// A string, or a list of strings and `{repeat, count}` segments (keeps huge vectors compact).
    struct Text: Decodable {
        let value: String

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let plain = try? container.decode(String.self) { value = plain; return }
            let segments = try container.decode([Segment].self)
            value = segments.map(\.text).joined()
        }

        struct Segment: Decodable {
            let text: String
            init(from decoder: Decoder) throws {
                let container = try decoder.singleValueContainer()
                if let plain = try? container.decode(String.self) { text = plain; return }
                let repeated = try container.decode(Repeat.self)
                text = String(repeating: repeated.repeat, count: repeated.count)
            }
        }
        struct Repeat: Decodable { let `repeat`: String; let count: Int }
    }

    struct Replacement: Decodable { let from: String; let to: String }

    struct Request: Decodable {
        let id: String
        let operation: String
        let payload: Text
        let suffix: Text?
        let replace: [Replacement]?

        func raw(id override: String? = nil) -> String {
            var text = "{\"version\":1,\"operation\":\"\(operation)\",\"requestId\":\"\(override ?? id)\",\"payload\":\(payload.value)\(suffix?.value ?? "")}"
            for item in replace ?? [] { text = text.replacingOccurrences(of: item.from, with: item.to) }
            return text
        }
    }

    struct Step: Decodable {
        let raw: Text?
        let request: Request?
        let range: Range?
        let invalidate: Bool?
        let expect: Expect?

        struct Range: Decodable { let idPrefix: String; let count: Int; let request: Request }

        func rawRequests() -> [(String, String)] {
            if let raw { return [(raw.value, "")] }
            if let request { return [(request.raw(), request.id)] }
            if let range {
                return (0..<range.count).map { index in
                    let id = "\(range.idPrefix)\(index)"
                    return (range.request.raw(id: id), id)
                }
            }
            return []
        }
    }
}

private extension SecureBridgeResponse {
    func with(requestId: String) -> SecureBridgeResponse {
        SecureBridgeResponse(requestId: requestId, operationRef: operationRef, state: state, error: error, operation: operation)
    }
}
