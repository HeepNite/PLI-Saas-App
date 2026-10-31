import Foundation
import Security

/// Thin seam over `SecItem*` so the exact attribute dictionaries are testable.
public protocol KeychainClient: AnyObject {
    func add(_ attributes: [String: Any]) -> OSStatus
    func update(query: [String: Any], attributes: [String: Any]) -> OSStatus
    func copy(query: [String: Any]) -> (status: OSStatus, data: Data?)
}

public final class SecItemKeychainClient: KeychainClient {
    public init() {}
    public func add(_ attributes: [String: Any]) -> OSStatus { SecItemAdd(attributes as CFDictionary, nil) }
    public func update(query: [String: Any], attributes: [String: Any]) -> OSStatus { SecItemUpdate(query as CFDictionary, attributes as CFDictionary) }
    public func copy(query: [String: Any]) -> (status: OSStatus, data: Data?) {
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        return (status, result as? Data)
    }
}

public enum KeychainStoreError: Error, Equatable {
    case unreadable, malformed, writeFailed, verificationFailed
}

/// Two generic-password items, both `AfterFirstUnlockThisDeviceOnly` (readable after the first unlock following a
/// reboot, never migrated to another device or backup) and never iCloud-synchronizable: the durable purchase state,
/// and the paired reader id, kept apart so pairing survives a state reset. Every write is read back before success.
public final class KeychainStore {
    public static let stateService = "com.pli.kiosk.internal-purchase-state"
    public static let stateAccount = "durable-state.v1"
    public static let readerService = "com.pli.kiosk.paired-reader"
    public static let readerAccount = "reader-id.v1"

    private let keychain: KeychainClient

    public init(keychain: KeychainClient = SecItemKeychainClient()) { self.keychain = keychain }

    /// A missing item is the empty state; unreadable or malformed state is never treated as empty.
    func readState() throws -> DurableState {
        guard let data = try read(Self.stateService, Self.stateAccount) else { return DurableState() }
        guard let state = try? JSONDecoder().decode(DurableState.self, from: data) else { throw KeychainStoreError.malformed }
        return state
    }

    func writeState(_ state: DurableState) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        guard let data = try? encoder.encode(state) else { throw KeychainStoreError.writeFailed }
        try write(data, Self.stateService, Self.stateAccount)
        guard (try? readState()) == state else { throw KeychainStoreError.verificationFailed }
    }

    /// The Stripe reader id (`tmr_...`) learned at first pairing, or `nil` when none (or an invalid one) is stored.
    public func readPairedReaderId() -> String? {
        guard let data = try? read(Self.readerService, Self.readerAccount), let value = String(data: data, encoding: .utf8),
              Self.isReaderId(value) else { return nil }
        return value
    }

    public func writePairedReaderId(_ id: String) throws {
        guard Self.isReaderId(id) else { throw KeychainStoreError.malformed }
        try write(Data(id.utf8), Self.readerService, Self.readerAccount)
        guard readPairedReaderId() == id else { throw KeychainStoreError.verificationFailed }
    }

    static func isReaderId(_ value: String) -> Bool { value.range(of: #"^tmr_[A-Za-z0-9_]+$"#, options: .regularExpression) != nil }

    private func identity(_ service: String, _ account: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
        ]
        #if os(macOS)
        query[kSecUseDataProtectionKeychain as String] = true
        #endif
        return query
    }

    private func read(_ service: String, _ account: String) throws -> Data? {
        var query = identity(service, account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        let (status, data) = keychain.copy(query: query)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data else { throw KeychainStoreError.unreadable }
        return data
    }

    private func write(_ data: Data, _ service: String, _ account: String) throws {
        let protection: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let identity = identity(service, account)
        var status = keychain.update(query: identity, attributes: protection)
        if status == errSecItemNotFound { status = keychain.add(identity.merging(protection) { _, new in new }) }
        guard status == errSecSuccess else { throw KeychainStoreError.writeFailed }
    }
}
