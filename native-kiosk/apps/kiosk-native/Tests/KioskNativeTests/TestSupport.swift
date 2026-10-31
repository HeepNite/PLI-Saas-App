import Foundation
import Security
@testable import KioskNative

enum Fixtures {
    static let origin = "https://pli.palladiumlatin.art"
    static let reference = String(repeating: "A", count: 42) + "A"
    static let serial = "STRM2D533025667"
    static let location = "tml_GqQ6wPY5rSAhAt"
    static let readerId = "tmr_exact"
    static let policy = ReaderPolicy(serial: serial, locationId: location)
    static let exact = SDKReader(stripeId: readerId, serialNumber: serial, deviceType: "stripe_m2", locationId: location)
    static let unregistered = SDKReader(stripeId: nil, serialNumber: serial, deviceType: "stripe_m2", locationId: nil)
}

/// Virtual clock: nothing fires until a test advances time or fires a pending task explicitly.
final class FakeScheduler: DeadlineScheduler {
    struct Entry { let id: Int; let delayMs: Int64; let dueAt: Int64; let task: () -> Void }
    private(set) var now: Int64 = 0
    private(set) var pending: [Entry] = []
    private var nextId = 0

    func schedule(delayMs: Int64, _ task: @escaping () -> Void) -> TerminalCancelable {
        nextId += 1
        let id = nextId
        pending.append(Entry(id: id, delayMs: delayMs, dueAt: now + delayMs, task: task))
        return TerminalCancelable { [self] in
            pending.removeAll { $0.id == id }
        }
    }

    func advance(byMs delta: Int64) {
        let target = now + delta
        while let next = pending.filter({ $0.dueAt <= target }).min(by: { $0.dueAt < $1.dueAt }) {
            pending.removeAll { $0.id == next.id }
            now = next.dueAt
            next.task()
        }
        now = target
    }

    func pendingDelays(where predicate: (Int64) -> Bool = { _ in true }) -> [Int64] {
        pending.map(\.delayMs).filter(predicate)
    }
}

final class FakePermissions: BluetoothPermissions {
    var granted: Bool
    private(set) var requests = 0
    init(granted: Bool) { self.granted = granted }
    func hasBluetoothPermissions() -> Bool { granted }
    func requestBluetoothPermissions() throws { requests += 1 }
}

struct FakeFailure: Error {}

/// Records SDK calls; tests drive every callback explicitly. Cancels finish immediately.
final class FakeSDK: TerminalSDKClient {
    var connectedReader: SDKReader?
    private(set) var setUps = 0, discoveries = 0, discoveryCancels = 0, connections = 0, disconnects = 0
    private(set) var lastDiscoveryTimeout: Int?
    private(set) var lastConnect: (locationId: String, autoReconnect: Bool)?
    private(set) var paymentOperations = [String](), retrievedSecrets = [String](), cancelledOperations = [String]()
    private(set) weak var events: TerminalSDKReaderEvents?
    private var tokenFetcher: ((@escaping (Result<String, Error>) -> Void) -> Void)?
    private var discoveryUpdate: (([SDKReader]) -> Void)?
    private var discoveryFinished: ((Bool) -> Void)?
    /// The live SDK reports a cancelled discovery through its completion with an error; tests opt in to mirror it.
    var reportsCancelledDiscoveryAsFailure = false
    private var connectCompletion: ((Result<SDKReader, Error>) -> Void)?
    private var retrieveCompletion, collectCompletion, confirmCompletion: ((Result<String, Error>) -> Void)?

    func setUp(connectionTokenFetcher: @escaping (@escaping (Result<String, Error>) -> Void) -> Void) {
        setUps += 1
        tokenFetcher = connectionTokenFetcher
    }

    func discoverReaders(timeoutSeconds: Int, simulated: Bool, onUpdate: @escaping ([SDKReader]) -> Void, onFinished: @escaping (Bool) -> Void) -> SDKCancel {
        discoveries += 1
        lastDiscoveryTimeout = timeoutSeconds
        discoveryUpdate = onUpdate
        discoveryFinished = onFinished
        return { [self] done in
            discoveryCancels += 1
            let finished = discoveryFinished
            discoveryUpdate = nil
            discoveryFinished = nil
            done()
            if reportsCancelledDiscoveryAsFailure { finished?(true) }
        }
    }

    func connect(_ reader: SDKReader, locationId: String, autoReconnect: Bool, events: TerminalSDKReaderEvents, completion: @escaping (Result<SDKReader, Error>) -> Void) {
        connections += 1
        lastConnect = (locationId, autoReconnect)
        self.events = events
        connectCompletion = completion
    }

    func disconnectReader() { disconnects += 1; connectedReader = nil }

    func retrievePaymentIntent(clientSecret: String, completion: @escaping (Result<String, Error>) -> Void) {
        paymentOperations.append("retrieve")
        retrievedSecrets.append(clientSecret)
        retrieveCompletion = completion
    }

    func collectPaymentMethod(intentId: String, completion: @escaping (Result<String, Error>) -> Void) -> SDKCancel {
        paymentOperations.append("collect")
        collectCompletion = completion
        return { [self] done in cancelledOperations.append("collect"); done() }
    }

    func confirmPaymentIntent(intentId: String, completion: @escaping (Result<String, Error>) -> Void) -> SDKCancel {
        paymentOperations.append("confirm")
        confirmCompletion = completion
        return { [self] done in cancelledOperations.append("confirm"); done() }
    }

    // MARK: Test drivers

    func token() throws -> String? {
        var result: Result<String, Error>?
        tokenFetcher? { result = $0 }
        return try result?.get()
    }
    func publish(_ readers: SDKReader...) { discoveryUpdate?(readers) }
    func failDiscovery() { discoveryFinished?(true) }
    func completeConnection(_ reader: SDKReader) { connectedReader = reader; connectCompletion?(.success(reader)) }
    func failConnection() { connectCompletion?(.failure(FakeFailure())) }
    func dropConnection() { connectedReader = nil; events?.sdkReaderDidDisconnect() }
    func retrieved(_ id: String) { retrieveCompletion?(.success(id)) }
    func collected(_ id: String) { collectCompletion?(.success(id)) }
    func collectFailed() { collectCompletion?(.failure(FakeFailure())) }
    func confirmed(_ id: String) { confirmCompletion?(.success(id)) }
}

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
    lazy var coordinator = PurchaseCoordinator(
        origin: Fixtures.origin, locationId: Fixtures.location, store: store, server: PurchaseServer(origin: Fixtures.origin, http: http),
        clock: { [unowned self] in now }, currentCookie: { [unowned self] in cookie }, execute: { $0() }
    )
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
