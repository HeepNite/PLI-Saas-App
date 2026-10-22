import Foundation

public enum SecureBridgeState: Equatable {
    case accepted
    case pending
    case rejected
}

public enum SecureBridgeError: Equatable {
    case requestTooLarge
    case malformedRequest
    case unsupportedVersion
    case unknownOperation
    case invalidPayload
    case requestIdConflict
    case responseCacheExhausted
    case internalError
    case staleContext
}

public struct SecureBridgeResponse: Equatable {
    public let requestId: String?
    public let operationRef: String?
    public let state: SecureBridgeState?
    public let error: SecureBridgeError?

    public init(requestId: String?, operationRef: String? = nil, state: SecureBridgeState? = nil, error: SecureBridgeError? = nil) {
        self.requestId = requestId
        self.operationRef = operationRef
        self.state = state
        self.error = error
    }
}

public struct SecureBridgeOperation {
    public let payloadSchema: [String: Int]
    public let handler: ([String: String]) throws -> SecureBridgeState

    public init(payloadSchema: [String: Int], handler: @escaping ([String: String]) throws -> SecureBridgeState) {
        self.payloadSchema = payloadSchema
        self.handler = handler
    }
}

public final class SecureBridge {
    private static let requestLimit = 16 * 1024
    private let registry: [String: SecureBridgeOperation]
    private let operationRefFactory: (String, String) throws -> String
    private let lock = NSLock()
    private var responses: [String: CachedResponse] = [:]
    private var closed = false

    public init(registry: [String: SecureBridgeOperation], operationRefFactory: @escaping (String, String) throws -> String) {
        precondition(registry.allSatisfy { Self.bounded($0.key, max: 64) })
        precondition(registry.values.allSatisfy { operation in
            operation.payloadSchema.allSatisfy { Self.bounded($0.key, max: 64) && (1...Self.requestLimit).contains($0.value) }
        })
        self.registry = registry
        self.operationRefFactory = operationRefFactory
    }

    public func dispatch(_ raw: String) -> SecureBridgeResponse {
        lock.lock()
        defer { lock.unlock() }
        guard !closed else { return failure(nil, .staleContext) }
        let bytes = Array(raw.utf8)
        guard bytes.count <= Self.requestLimit else { return failure(nil, .requestTooLarge) }
        var parser = Parser(raw)
        guard let envelope = parser.parse() else { return failure(nil, .malformedRequest) }
        if let cached = responses[envelope.requestId] {
            return cached.bytes == bytes ? cached.response : failure(envelope.requestId, .requestIdConflict)
        }
        guard responses.count < 256 else {
            closed = true
            responses.removeAll()
            return failure(envelope.requestId, .responseCacheExhausted)
        }
        let response: SecureBridgeResponse
        if envelope.version != "1" {
            response = failure(envelope.requestId, .unsupportedVersion)
        } else if let operation = registry[envelope.operation] {
            response = invoke(operation, envelope: envelope)
        } else {
            response = failure(envelope.requestId, .unknownOperation)
        }
        responses[envelope.requestId] = CachedResponse(bytes: bytes, response: response)
        return response
    }

    public func invalidate() {
        lock.lock()
        defer { lock.unlock() }
        closed = true
        responses.removeAll()
    }

    private func invoke(_ operation: SecureBridgeOperation, envelope: Envelope) -> SecureBridgeResponse {
        guard let fields = validatedFields(envelope.payload, schema: operation.payloadSchema) else {
            return failure(envelope.requestId, .invalidPayload)
        }
        do {
            let state = try operation.handler(fields)
            let reference = try operationRefFactory(envelope.requestId, envelope.operation)
            guard Self.bounded(reference, max: 128) else { throw BridgeFailure.invalidReference }
            return SecureBridgeResponse(requestId: envelope.requestId, operationRef: reference, state: state)
        } catch {
            return failure(envelope.requestId, .internalError)
        }
    }

    private func validatedFields(_ fields: [String: String], schema: [String: Int]) -> [String: String]? {
        guard Set(fields.keys) == Set(schema.keys) else { return nil }
        guard fields.allSatisfy({ field in Self.bounded(field.value, max: schema[field.key]!) }) else { return nil }
        return fields
    }

    private func failure(_ requestId: String?, _ error: SecureBridgeError) -> SecureBridgeResponse {
        SecureBridgeResponse(requestId: requestId, error: error)
    }

    private static func bounded(_ value: String, max: Int) -> Bool {
        !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && value.count <= max
    }

    private enum BridgeFailure: Error { case invalidReference }
    private struct CachedResponse { let bytes: [UInt8]; let response: SecureBridgeResponse }
    private struct Envelope { let version: String; let operation: String; let requestId: String; let payload: [String: String] }

    private struct Parser {
        private let source: [Character]
        private var index = 0

        init(_ raw: String) { source = Array(raw) }

        mutating func parse() -> Envelope? {
            whitespace()
            guard consume("{") else { return nil }
            var keys = Set<String>()
            var version: String?
            var operation: String?
            var requestId: String?
            var payload: [String: String]?
            whitespace()
            while !consume("}") {
                guard let key = string(), keys.insert(key).inserted, afterKey() else { return nil }
                switch key {
                case "version": version = number()
                case "operation": operation = string()
                case "requestId": requestId = string()
                case "payload": payload = objectOfStrings()
                default: return nil
                }
                guard version != nil || key != "version",
                      operation != nil || key != "operation",
                      requestId != nil || key != "requestId",
                      payload != nil || key != "payload" else { return nil }
                whitespace()
                if consume("}") { break }
                guard consume(",") else { return nil }
                whitespace()
                guard current != "}" else { return nil }
            }
            whitespace()
            guard index == source.count, keys == Set(["version", "operation", "requestId", "payload"]),
                  let version, let operation, let requestId, let payload,
                  Self.bounded(operation, max: 64), Self.bounded(requestId, max: 128) else { return nil }
            return Envelope(version: version, operation: operation, requestId: requestId, payload: payload)
        }

        private mutating func objectOfStrings() -> [String: String]? {
            guard consume("{") else { return nil }
            var fields = [String: String]()
            whitespace()
            while !consume("}") {
                guard let key = string(), fields[key] == nil, afterKey(), let value = string() else { return nil }
                fields[key] = value
                whitespace()
                if consume("}") { break }
                guard consume(",") else { return nil }
                whitespace()
                guard current != "}" else { return nil }
            }
            return fields
        }

        private mutating func afterKey() -> Bool {
            whitespace()
            guard consume(":") else { return false }
            whitespace()
            return true
        }

        private mutating func string() -> String? {
            guard consume("\"") else { return nil }
            var result = ""
            while let character = current {
                index += 1
                switch character {
                case "\"": return result
                case "\\":
                    guard let escaped = current else { return nil }
                    index += 1
                    switch escaped {
                    case "\"", "\\", "/": result.append(escaped)
                    case "b": result.append("\u{08}")
                    case "f": result.append("\u{0C}")
                    case "n": result.append("\n")
                    case "r": result.append("\r")
                    case "t": result.append("\t")
                    case "u":
                        let hex = String(source.dropFirst(index).prefix(4))
                        guard hex.count == 4, hex.allSatisfy({ ("0"..."9").contains($0) || ("A"..."F").contains($0) || ("a"..."f").contains($0) }), let scalar = UInt32(hex, radix: 16), let unicode = UnicodeScalar(scalar) else { return nil }
                        result.unicodeScalars.append(unicode)
                        index += 4
                    default: return nil
                    }
                default:
                    guard character >= " " else { return nil }
                    result.append(character)
                }
            }
            return nil
        }

        private mutating func number() -> String? {
            let start = index
            _ = consume("-")
            if consume("0") {
            } else if current.map({ $0 >= "1" && $0 <= "9" }) == true {
                while current.map({ $0 >= "0" && $0 <= "9" }) == true { index += 1 }
            } else { return nil }
            if consume(".") {
                guard current.map({ $0 >= "0" && $0 <= "9" }) == true else { return nil }
                while current.map({ $0 >= "0" && $0 <= "9" }) == true { index += 1 }
            }
            if current == "e" || current == "E" {
                index += 1
                _ = consume("+") || consume("-")
                guard current.map({ $0 >= "0" && $0 <= "9" }) == true else { return nil }
                while current.map({ $0 >= "0" && $0 <= "9" }) == true { index += 1 }
            }
            return String(source[start..<index])
        }

        private var current: Character? { index < source.count ? source[index] : nil }
        private mutating func consume(_ character: Character) -> Bool {
            guard current == character else { return false }
            index += 1
            return true
        }
        private mutating func whitespace() {
            while current == " " || current == "\t" || current == "\n" || current == "\r" { index += 1 }
        }
        private static func bounded(_ value: String, max: Int) -> Bool {
            !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && value.count <= max
        }
    }
}
