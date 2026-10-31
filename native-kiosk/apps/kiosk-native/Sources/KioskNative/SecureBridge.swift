import CryptoKit
import Foundation

/// The only states a web caller may learn about a validated native operation.
public enum SecureBridgeState: String, CaseIterable, Equatable {
    case accepted
    case pending
    case paid
    case rejected
}

/// Closed failures deliberately omit parser, handler, and platform details.
public enum SecureBridgeError: String, CaseIterable, Equatable {
    case requestTooLarge = "REQUEST_TOO_LARGE"
    case malformedRequest = "MALFORMED_REQUEST"
    case unsupportedVersion = "UNSUPPORTED_VERSION"
    case unknownOperation = "UNKNOWN_OPERATION"
    case invalidPayload = "INVALID_PAYLOAD"
    case requestIdConflict = "REQUEST_ID_CONFLICT"
    case internalError = "INTERNAL_ERROR"
    case staleContext = "STALE_CONTEXT"
}

/// A bridge reply has no diagnostic text or native/provider object surface.
public struct SecureBridgeResponse: Equatable {
    public let requestId: String?
    public let operationRef: String?
    public let state: SecureBridgeState?
    public let error: SecureBridgeError?
    public let operation: String?

    public init(requestId: String?, operationRef: String? = nil, state: SecureBridgeState? = nil, error: SecureBridgeError? = nil, operation: String? = nil) {
        self.requestId = requestId
        self.operationRef = operationRef
        self.state = state
        self.error = error
        self.operation = operation
    }
}

public struct SecureBridgeOperationResult: Equatable {
    let operationRef: String?
    let state: SecureBridgeState
}

/// An allowlisted operation with its complete string-only payload schema. The handler receives the validated request
/// ID and the pre-generated operation reference, and controls the reference returned to the web caller.
public struct SecureBridgeOperation {
    public let payloadSchema: [String: Int]
    let handler: (String, String, [String: String]) throws -> SecureBridgeOperationResult

    public init(payloadSchema: [String: Int], handler: @escaping (_ requestId: String, _ operationRef: String, _ fields: [String: String]) throws -> SecureBridgeOperationResult) {
        self.payloadSchema = payloadSchema
        self.handler = handler
    }
}

/// Framework-neutral request parser and serialized dispatcher for one reader/session/origin context.
/// Construct a fresh instance for a replacement context; `invalidate()` permanently closes this one.
public final class SecureBridge {
    private static let requestLimit = 16 * 1024
    private static let cacheLimit = 256
    private static let maxOperation = 64
    private static let maxRequestId = 128
    private static let maxFieldName = 64
    private static let maxOperationRef = 128

    private let registry: [String: SecureBridgeOperation]
    private let operationRefFactory: (String, String) throws -> String
    private let lock = NSLock()
    /// Bounded replay cache; when full the oldest entry is evicted instead of refusing (Kotlin #750).
    /// Web polls every 500 ms during a sale, so a hard cap starved the bridge. Eviction is safe: polls are
    /// read-only and a start is bound to a single-use server prepared reference.
    private var responses: [String: CachedResponse] = [:]
    private var responseOrder: [String] = []
    private var closed = false

    public init(registry: [String: SecureBridgeOperation], operationRefFactory: @escaping (String, String) throws -> String) {
        precondition(registry.allSatisfy { Self.bounded($0.key, max: Self.maxOperation) })
        precondition(registry.values.allSatisfy { operation in
            operation.payloadSchema.allSatisfy { Self.bounded($0.key, max: Self.maxFieldName) && (1...Self.requestLimit).contains($0.value) }
        })
        self.registry = registry
        self.operationRefFactory = operationRefFactory
    }

    public func dispatch(_ raw: String) -> SecureBridgeResponse {
        lock.lock()
        defer { lock.unlock() }
        guard !closed else { return failure(nil, .staleContext) }
        guard raw.utf16.count <= Self.requestLimit, raw.utf8.count <= Self.requestLimit else { return failure(nil, .requestTooLarge) }
        guard let envelope = EnvelopeParser.parse(raw),
              Self.bounded(envelope.operation, max: Self.maxOperation),
              Self.bounded(envelope.requestId, max: Self.maxRequestId) else { return failure(nil, .malformedRequest) }
        let digest = Array(SHA256.hash(data: Data(raw.utf8)))
        if let cached = responses[envelope.requestId] {
            return cached.digest == digest ? cached.response : failure(envelope.requestId, .requestIdConflict, envelope.operation)
        }
        let response = envelope.version == 1 ? dispatch(envelope) : failure(envelope.requestId, .unsupportedVersion, envelope.operation)
        while responseOrder.count >= Self.cacheLimit { responses[responseOrder.removeFirst()] = nil }
        responses[envelope.requestId] = CachedResponse(digest: digest, response: response)
        responseOrder.append(envelope.requestId)
        return response
    }

    public func invalidate() {
        lock.lock()
        defer { lock.unlock() }
        closed = true
        responses.removeAll()
        responseOrder.removeAll()
    }

    private func dispatch(_ envelope: EnvelopeParser.Envelope) -> SecureBridgeResponse {
        guard let operation = registry[envelope.operation] else { return failure(envelope.requestId, .unknownOperation, envelope.operation) }
        guard let fields = validatedFields(envelope.payload, schema: operation.payloadSchema) else {
            return failure(envelope.requestId, .invalidPayload, envelope.operation)
        }
        do {
            let reference = try operationRefFactory(envelope.requestId, envelope.operation)
            guard Self.bounded(reference, max: Self.maxOperationRef) else { throw BridgeFailure.invalidReference }
            let result = try operation.handler(envelope.requestId, reference, fields)
            return SecureBridgeResponse(requestId: envelope.requestId, operationRef: result.operationRef, state: result.state, operation: envelope.operation)
        } catch {
            return failure(envelope.requestId, .internalError, envelope.operation)
        }
    }

    private func validatedFields(_ fields: [String: String], schema: [String: Int]) -> [String: String]? {
        guard Set(fields.keys) == Set(schema.keys) else { return nil }
        guard fields.allSatisfy({ Self.bounded($0.value, max: schema[$0.key]!) }) else { return nil }
        return fields
    }

    private func failure(_ requestId: String?, _ error: SecureBridgeError, _ operation: String? = nil) -> SecureBridgeResponse {
        SecureBridgeResponse(requestId: requestId, error: error, operation: operation)
    }

    /// Non-blank and at most `max` UTF-16 code units; the value is never trimmed (matches Kotlin `String.length`).
    static func bounded(_ value: String, max: Int) -> Bool {
        value.utf16.count <= max && value.unicodeScalars.contains { !isBlank($0) }
    }

    private static func isBlank(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x1C...0x1F: true
        case 0x85: false
        default: scalar.properties.isWhitespace
        }
    }

    private enum BridgeFailure: Error { case invalidReference }
    /// Retains only a fixed SHA-256 digest, never raw request/capability bytes.
    private struct CachedResponse { let digest: [UInt8]; let response: SecureBridgeResponse }
}

/// Envelope parsing: `JSONSerialization` for the grammar plus explicit shape checks. Foundation collapses duplicate
/// keys and tolerates trailing commas, so `keyCounts` re-scans the validated text for both.
private enum EnvelopeParser {
    struct Envelope { let version: Int?; let operation: String; let requestId: String; let payload: [String: String] }

    private static let envelopeKeys: Set<String> = ["version", "operation", "requestId", "payload"]

    static func parse(_ raw: String) -> Envelope? {
        guard let object = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
              Set(object.keys) == envelopeKeys,
              let operation = object["operation"] as? String,
              let requestId = object["requestId"] as? String,
              let payload = object["payload"] as? [String: Any],
              let version = object["version"] as? NSNumber, CFGetTypeID(version) != CFBooleanGetTypeID() else { return nil }
        var fields = [String: String]()
        for (key, value) in payload {
            guard let text = value as? String else { return nil }
            fields[key] = text
        }
        guard let counts = keyCounts(raw), counts == [object.count, payload.count] else { return nil }
        // Only the exact integer 1 is supported; 1.0, 1e0 and other numbers are well-formed but unsupported.
        let supported = !CFNumberIsFloatType(version) && version.int64Value == 1
        return Envelope(version: supported ? 1 : nil, operation: operation, requestId: requestId, payload: fields)
    }

    /// Counts `"key":` tokens at object depth 1 (envelope) and 2 (payload) of text already validated as JSON;
    /// nil when any container ends with a trailing comma.
    private static func keyCounts(_ raw: String) -> [Int]? {
        var counts = [0, 0, 0]
        var depth = 0
        var inString = false
        var escaped = false
        var stringDepth = 0
        var pendingKey = false
        var previous: UInt8 = 0
        for unit in raw.utf8 {
            if inString {
                if escaped { escaped = false } else if unit == 0x5C { escaped = true } else if unit == 0x22 { inString = false; pendingKey = true }
                continue
            }
            switch unit {
            case 0x22: inString = true; stringDepth = depth; pendingKey = false
            case 0x3A where pendingKey: if stringDepth <= 2 { counts[stringDepth] += 1 }; pendingKey = false
            case 0x20, 0x09, 0x0A, 0x0D: continue
            case 0x7B, 0x5B: depth += 1; pendingKey = false
            case 0x7D, 0x5D:
                if previous == 0x2C { return nil }
                depth -= 1
                pendingKey = false
            default: pendingKey = false
            }
            previous = unit
        }
        return [counts[1], counts[2]]
    }
}

/// Serializes the closed reply envelope pushed back to the web page (byte-identical to the Android adapter).
public enum WebKitBridgeAdapter {
    private static let pollOperation = "getPreparedPurchaseState"

    /// Returns a reply only when the web closed-envelope parser would accept it; `paid` is exposed solely for the state poll.
    public static func replyJSON(_ response: SecureBridgeResponse) -> String? {
        guard let operation = response.operation, let operationRef = response.operationRef, let state = response.state,
              state != .paid || operation == pollOperation else { return nil }
        return "{\"version\":1,\"operation\":\(json(operation)),\"requestId\":\(json(response.requestId)),\"payload\":{\"operationReference\":\(json(operationRef)),\"state\":\(json(state.rawValue))}}"
    }

    private static func json(_ value: String?) -> String {
        guard let value else { return "null" }
        var result = "\""
        for scalar in value.unicodeScalars {
            switch scalar {
            case "\\": result += "\\\\"
            case "\"": result += "\\\""
            case "\u{08}": result += "\\b"
            case "\u{0C}": result += "\\f"
            case "\n": result += "\\n"
            case "\r": result += "\\r"
            case "\t": result += "\\t"
            default:
                if scalar.value < 0x20 { result += String(format: "\\u%04x", scalar.value) } else { result.unicodeScalars.append(scalar) }
            }
        }
        return result + "\""
    }
}
