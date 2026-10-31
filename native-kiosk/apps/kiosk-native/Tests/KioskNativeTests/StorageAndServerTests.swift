import Security
import XCTest
@testable import KioskNative

/// Keychain attributes and read-back, the fixed server protocol, and the hardened HTTP client.
final class StorageAndServerTests: XCTestCase {
    private let world = World()

    // MARK: Keychain

    func testBothItemsAreDeviceOnlyAfterFirstUnlockNeverSynchronizableAndReadBack() throws {
        let state = DurableState(session: world.session, attempt: RetainedAttempt(ticket: world.ticket, paymentIntentId: "pi_1"))
        try world.store.writeState(state)
        try world.store.writePairedReaderId("tmr_new")
        XCTAssertEqual(try world.store.readState(), state)
        XCTAssertEqual(world.store.readPairedReaderId(), "tmr_new")
        XCTAssertEqual(world.keychain.adds.map { $0[kSecAttrService as String] as? String }, [KeychainStore.stateService, KeychainStore.readerService])
        for attributes in world.keychain.adds {
            XCTAssertEqual(attributes[kSecAttrAccessible as String] as? String, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
            XCTAssertEqual(attributes[kSecAttrSynchronizable as String] as? Bool, false)
        }
        XCTAssertTrue(world.keychain.copies.allSatisfy { $0[kSecAttrSynchronizable as String] as? Bool == false })
        try world.store.writeState(DurableState(session: world.session))
        XCTAssertEqual(world.keychain.updates.last?[kSecAttrAccessible as String] as? String, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
    }

    func testMissingIsEmptyButUnreadableMalformedOrUnwritableStateFailsClosed() {
        XCTAssertEqual(try world.store.readState(), DurableState())
        XCTAssertNil(world.store.readPairedReaderId())
        world.keychain.items["\(KeychainStore.stateService)|\(KeychainStore.stateAccount)"] = Data(#"{"session":7}"#.utf8)
        XCTAssertThrowsError(try world.store.readState()) { XCTAssertEqual($0 as? KeychainStoreError, .malformed) }
        XCTAssertThrowsError(try world.store.writePairedReaderId("not-a-reader"))
        world.keychain.failReads = true
        XCTAssertThrowsError(try world.store.readState()) { XCTAssertEqual($0 as? KeychainStoreError, .unreadable) }
        world.keychain.failReads = false
        world.keychain.failWrites = true
        XCTAssertThrowsError(try world.store.writeState(DurableState())) { XCTAssertEqual($0 as? KeychainStoreError, .writeFailed) }
    }

    // MARK: Server protocol

    func testEachActionSendsOnlyItsFixedFieldsWithTheNativeCookie() throws {
        let server = PurchaseServer(origin: Fixtures.origin, http: world.http)
        XCTAssertEqual(try server.connectionToken(world.session), "tok")
        XCTAssertEqual(try server.preparedAttempt(world.session, reference: Fixtures.reference), world.ticket)
        XCTAssertEqual(try server.paymentIntent(world.session, world.ticket, knownId: nil).clientSecret, "pi_1_secret")
        _ = try server.recover(world.session, world.ticket, id: "pi_1")
        _ = try server.cancel(world.session, world.ticket, id: "pi_1")
        XCTAssertTrue(try server.isUncreated(world.session, world.ticket))
        XCTAssertEqual(world.http.bodies, [
            ["action": "connection-token"],
            ["action": "prepared-attempt", "preparedPurchaseReference": Fixtures.reference],
            ["action": "prepared-payment-intent", "ticket": "ticket-1"],
            ["action": "prepared-recover", "ticket": "ticket-1", "paymentIntentId": "pi_1"],
            ["action": "prepared-cancel", "ticket": "ticket-1", "paymentIntentId": "pi_1"],
            ["action": "prepared-creation-status", "ticket": "ticket-1"],
        ])
        XCTAssertEqual(Set(world.http.cookies), ["cookie"])
    }

    func testResponsesOutsideTheContractAreRefused() {
        let server = PurchaseServer(origin: Fixtures.origin, http: world.http)
        let refused: [(String, String, () throws -> Any)] = [
            ("prepared-recover", FakeServer.payment("succeeded", secret: true), { try server.recover(self.world.session, self.world.ticket, id: "pi_1") }),
            ("prepared-recover", #"{"id":"pi_1","status":"succeeded","paid":false}"#, { try server.recover(self.world.session, self.world.ticket, id: "pi_1") }),
            ("prepared-cancel", #"{"id":" ","status":"canceled","paid":false}"#, { try server.cancel(self.world.session, self.world.ticket, id: "pi_1") }),
            ("prepared-payment-intent", FakeServer.payment("requires_payment_method"), { try server.paymentIntent(self.world.session, self.world.ticket, knownId: nil) }),
            ("prepared-attempt", #"{"ticket":"t","expiresAt":"soon","readerId":"r","locationId":"l"}"#, { try server.preparedAttempt(self.world.session, reference: "r") }),
            ("prepared-creation-status", #"{"creation":"MAYBE"}"#, { try server.isUncreated(self.world.session, self.world.ticket) }),
            ("connection-token", #"{"secret":" "}"#, { try server.connectionToken(self.world.session) }),
        ]
        for (action, body, call) in refused {
            world.http.responses[action] = body
            XCTAssertThrowsError(try call(), "\(action) \(body)")
        }
        world.http.responses["connection-token"] = nil
        XCTAssertThrowsError(try server.connectionToken(world.session), "non-2xx")
    }

    // MARK: HTTP client

    private let url = URL(string: Fixtures.origin + PurchaseServer.path)!

    private func client() -> URLSessionHTTPClient {
        StubURLProtocol.reset()
        let client = URLSessionHTTPClient()
        client.configuration.protocolClasses = [StubURLProtocol.self]
        return client
    }

    func testPostsJsonWithOnlyTheExplicitCookieHeaderAndNoSharedJarOrCache() throws {
        let client = client()
        StubURLProtocol.stub = .init(status: 409, body: Data(#"{"error":"x"}"#.utf8))
        let response = try client.post(url, json: Data("{}".utf8), cookie: "abc123")
        XCTAssertEqual(response.status, 409, "error statuses are returned to the caller")
        let request = try XCTUnwrap(StubURLProtocol.requests.first)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Cookie"), "pli_terminal_session=abc123")
        XCTAssertFalse(request.httpShouldHandleCookies)
        XCTAssertNil(client.configuration.httpCookieStorage)
        XCTAssertEqual(client.configuration.httpCookieAcceptPolicy, .never)
        XCTAssertNil(client.configuration.urlCache)
    }

    func testRedirectsNonHttpsOversizeAndTransportErrorsAreRefused() {
        let client = client()
        StubURLProtocol.stub = .init(status: 302, headers: ["Location": "https://evil.invalid/"])
        XCTAssertThrowsError(try client.post(url, json: Data(), cookie: "c"))
        StubURLProtocol.stub = .init(status: 200, headers: ["Location": "https://evil.invalid/"])
        XCTAssertThrowsError(try client.post(url, json: Data(), cookie: "c"), "a Location header is refused even on 200")
        StubURLProtocol.stub = .init(status: 200, body: Data(repeating: 0x41, count: URLSessionHTTPClient.maxResponseBytes + 1))
        XCTAssertThrowsError(try client.post(url, json: Data(), cookie: "c"))
        StubURLProtocol.stub = .init(error: URLError(.notConnectedToInternet))
        XCTAssertThrowsError(try client.post(url, json: Data(), cookie: "c"))
        let sent = StubURLProtocol.requests.count
        for bad in ["http://approved.invalid/x", "https://u:p@approved.invalid/x", "https://approved.invalid/x?q=1"] {
            XCTAssertThrowsError(try client.post(URL(string: bad)!, json: Data(), cookie: "c"), bad)
        }
        XCTAssertEqual(StubURLProtocol.requests.count, sent)
    }
}

/// URLProtocol stub: the only network the HTTP client tests ever see.
final class StubURLProtocol: URLProtocol {
    struct Stub {
        var status = 200
        var headers: [String: String] = [:]
        var body = Data()
        var error: Error?
    }
    nonisolated(unsafe) static var stub = Stub()
    nonisolated(unsafe) static var requests = [URLRequest]()
    static func reset() { stub = Stub(); requests = [] }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        Self.requests.append(request)
        if let error = Self.stub.error { return client!.urlProtocol(self, didFailWithError: error) }
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.stub.status, httpVersion: "HTTP/1.1", headerFields: Self.stub.headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.stub.body)
        client?.urlProtocolDidFinishLoading(self)
    }
}
