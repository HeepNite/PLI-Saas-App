import Foundation
import Security
@testable import KioskNative

enum Fixtures {
    static let origin = "https://pli.palladiumlatin.art"
    static let location = "tml_GqQ6wPY5rSAhAt"
    static let readerId = "tmr_exact"
}

struct FakeFailure: Error {}

/// In-memory Keychain keyed by service/account; records the attribute dictionaries it was sent.
final class FakeKeychain: KeychainClient {
    var items = [String: Data]()
    var failWrites = false
    var failReads = false
    private(set) var adds = [[String: Any]]()
    private(set) var updates = [[String: Any]]()
    private(set) var copies = [[String: Any]]()

    private func key(_ query: [String: Any]) -> String { "\(query[kSecAttrService as String] ?? "")|\(query[kSecAttrAccount as String] ?? "")" }

    func add(_ attributes: [String: Any]) -> OSStatus {
        adds.append(attributes)
        if failWrites { return errSecIO }
        items[key(attributes)] = attributes[kSecValueData as String] as? Data
        return errSecSuccess
    }

    func update(query: [String: Any], attributes: [String: Any]) -> OSStatus {
        updates.append(query.merging(attributes) { _, new in new })
        if failWrites { return errSecIO }
        guard items[key(query)] != nil else { return errSecItemNotFound }
        items[key(query)] = attributes[kSecValueData as String] as? Data
        return errSecSuccess
    }

    func copy(query: [String: Any]) -> (status: OSStatus, data: Data?) {
        copies.append(query)
        if failReads { return (errSecIO, nil) }
        guard let data = items[key(query)] else { return (errSecItemNotFound, nil) }
        return (errSecSuccess, data)
    }
}

/// The real coordinator over a fake Keychain and server, a settable clock and cookie, and inline execution.
final class World {
    let keychain = FakeKeychain()
    var now: Int64 = 1_000
    var cookie: String? = "cookie"
    lazy var store = KeychainStore(keychain: keychain)
    var session: StaffSession { StaffSession(origin: Fixtures.origin, cookie: "cookie", expiresAt: 100_000_000) }
    let ticket = AttemptTicket(value: "ticket-1", expiresAt: 100_000_000, readerId: Fixtures.readerId, locationId: Fixtures.location)

    var state: DurableState {
        get { try! store.readState() }
        set { try! store.writeState(newValue) }
    }
}

final class ClosureWebEventTarget: NativeWebEventTarget {
    private let deliver: (String) throws -> Void
    init(_ deliver: @escaping (String) throws -> Void) { self.deliver = deliver }
    func post(_ message: String) throws { try deliver(message) }
}
