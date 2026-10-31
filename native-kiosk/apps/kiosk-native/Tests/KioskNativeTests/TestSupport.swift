import Foundation
import Security
@testable import KioskNative

enum Fixtures {
    static let origin = "https://pli.palladiumlatin.art"
    static let reference = String(repeating: "A", count: 42) + "A"
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

/// The internal-purchase endpoint, answered by `action`. Records `action[:paymentIntentId]` and the cookies it saw.
final class FakeServer: HTTPClient {
    static func payment(_ status: String, id: String = "pi_1", secret: Bool = false) -> String {
        #"{"id":"\#(id)","status":"\#(status)","paid":\#(status == "succeeded")\#(secret ? #","clientSecret":"pi_1_secret""# : "")}"#
    }

    var responses: [String: String] = [
        "connection-token": #"{"secret":"tok"}"#,
        "prepared-attempt": #"{"ticket":"ticket-1","expiresAt":100000000,"readerId":"tmr_exact","locationId":"\#(Fixtures.location)"}"#,
        "prepared-payment-intent": payment("requires_payment_method", secret: true),
        "prepared-recover": payment("requires_payment_method"),
        "prepared-cancel": payment("canceled"),
        "prepared-creation-status": #"{"creation":"UNCREATED"}"#,
    ]
    var failing = Set<String>()
    var onCall: (String) -> Void = { _ in }
    private(set) var calls = [String]()
    private(set) var cookies = [String]()
    private(set) var bodies = [[String: String]]()

    func post(_ url: URL, json: Data, cookie: String) throws -> (status: Int, body: Data) {
        precondition(url.absoluteString == Fixtures.origin + PurchaseServer.path)
        let body = (try? JSONSerialization.jsonObject(with: json)) as? [String: String] ?? [:]
        let action = body["action"] ?? ""
        calls.append(action + (body["paymentIntentId"].map { ":\($0)" } ?? ""))
        cookies.append(cookie)
        bodies.append(body)
        onCall(action)
        if failing.contains(action) { throw FakeFailure() }
        guard let response = responses[action] else { return (400, Data()) }
        return (200, Data(response.utf8))
    }
}

/// The real coordinator over a fake Keychain and server, a settable clock and cookie, and inline execution.
final class World {
    let keychain = FakeKeychain()
    let http = FakeServer()
    var now: Int64 = 1_000
    var cookie: String? = "cookie"
    lazy var store = KeychainStore(keychain: keychain)
    var session: StaffSession { StaffSession(origin: Fixtures.origin, cookie: "cookie", expiresAt: 100_000_000) }
    let ticket = AttemptTicket(value: "ticket-1", expiresAt: 100_000_000, readerId: Fixtures.readerId, locationId: Fixtures.location)

    var state: DurableState {
        get { try! store.readState() }
        set { try! store.writeState(newValue) }
    }
    var actions: [String] { http.calls }
}

final class ClosureWebEventTarget: NativeWebEventTarget {
    private let deliver: (String) throws -> Void
    init(_ deliver: @escaping (String) throws -> Void) { self.deliver = deliver }
    func post(_ message: String) throws { try deliver(message) }
}
