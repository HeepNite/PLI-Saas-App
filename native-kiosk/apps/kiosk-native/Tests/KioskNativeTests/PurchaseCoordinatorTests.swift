import XCTest
@testable import KioskNative

/// Session capture, the single retained attempt, PaymentIntent binding and server-authoritative clearing.
final class PurchaseCoordinatorTests: XCTestCase {
    private let world = World()
    private var coordinator: PurchaseCoordinator { world.coordinator }
    private var recovered = 0

    private func retain(paymentIntentId: String? = "pi_1", ticket: Bool = true) {
        world.state = DurableState(session: world.session, attempt: RetainedAttempt(ticket: ticket ? world.ticket : nil, paymentIntentId: paymentIntentId))
    }

    private func capture() -> Bool { coordinator.capture { self.recovered += 1 } }

    private func reason(_ call: () throws -> Any) -> String? {
        do { _ = try call(); return nil } catch { return (error as? PurchaseError)?.reason }
    }

    // MARK: Session

    func testCaptureStoresTheCookieForFifteenMinutesAndRenewalKeepsTheSameSessionOnly() {
        world.cookie = nil
        XCTAssertFalse(capture())
        world.cookie = "cookie"
        XCTAssertTrue(capture())
        XCTAssertEqual(world.state, DurableState(session: StaffSession(origin: Fixtures.origin, cookie: "cookie", expiresAt: 1_000 + 900_000)))
        world.now = 2_000
        XCTAssertTrue(coordinator.renewSession())
        XCTAssertEqual(world.state.session?.expiresAt, 2_000 + 900_000)
        world.cookie = "other"
        XCTAssertFalse(coordinator.renewSession(), "never adopts a different session")
        XCTAssertEqual(world.state.session?.cookie, "cookie")
        XCTAssertEqual(try? coordinator.connectionToken(), "tok")
        world.state = DurableState(session: StaffSession(origin: Fixtures.origin, cookie: "foreign", expiresAt: 100_000_000))
        XCTAssertThrowsError(try coordinator.connectionToken(), "tokens only for the captured session")
    }

    // MARK: Sale

    func testAdmissionPersistsTheMarkerBeforeTheServerCallThenTheTicket() throws {
        world.state = DurableState(session: world.session)
        var markerAtCall: RetainedAttempt?
        world.http.onCall = { if $0 == "prepared-attempt" { markerAtCall = self.world.state.attempt } }
        XCTAssertEqual(try coordinator.admit(Fixtures.reference), world.ticket)
        XCTAssertEqual(markerAtCall, RetainedAttempt())
        XCTAssertEqual(world.state.attempt, RetainedAttempt(ticket: world.ticket))
        XCTAssertEqual(reason { try self.coordinator.admit(Fixtures.reference) }, "attempt_retained", "one attempt at a time")
    }

    func testAFailedIssuanceKeepsTheMarkerSoALostResponseIsNeverReplayed() {
        world.state = DurableState(session: world.session)
        world.http.failing = ["prepared-attempt"]
        XCTAssertEqual(reason { try self.coordinator.admit(Fixtures.reference) }, "server")
        XCTAssertEqual(world.state.attempt, RetainedAttempt())
        XCTAssertFalse(capture(), "a ticketless marker keeps the kiosk locked")
        XCTAssertEqual(world.actions, ["prepared-attempt"])
    }

    func testAdmissionRefusesBadReferencesExpiredSessionsAndForeignOrExpiredTickets() {
        world.state = DurableState(session: world.session)
        for bad in ["", String(repeating: "A", count: 42), String(repeating: "A", count: 42) + "B", String(repeating: "Ä", count: 43)] {
            XCTAssertEqual(reason { try self.coordinator.admit(bad) }, "invalid_reference")
        }
        world.state = DurableState(session: StaffSession(origin: Fixtures.origin, cookie: "cookie", expiresAt: 500))
        XCTAssertEqual(reason { try self.coordinator.admit(Fixtures.reference) }, "session_expired")
        XCTAssertTrue(world.actions.isEmpty)
        for ticket in [#"{"ticket":"t","expiresAt":100000000,"readerId":"tmr_exact","locationId":"tml_other"}"#, #"{"ticket":"t","expiresAt":10,"readerId":"tmr_exact","locationId":"\#(Fixtures.location)"}"#] {
            world.state = DurableState(session: world.session)
            world.http.responses["prepared-attempt"] = ticket
            XCTAssertEqual(reason { try self.coordinator.admit(Fixtures.reference) }, "invalid_ticket", "not poisoned by an expired session")
        }
    }

    func testCollectionPersistsOnlyTheIntentIdAndRefusesDriftOrPaid() throws {
        retain(paymentIntentId: nil)
        let start = try coordinator.startCollection()
        XCTAssertEqual(start, CollectionStart(ticket: world.ticket, paymentIntentId: "pi_1", clientSecret: "pi_1_secret"))
        XCTAssertEqual(world.state.attempt, RetainedAttempt(ticket: world.ticket, paymentIntentId: "pi_1"))
        XCTAssertFalse(world.keychain.items.values.contains { String(decoding: $0, as: UTF8.self).contains("secret") })
        world.http.responses["prepared-payment-intent"] = FakeServer.payment("requires_payment_method", id: "pi_2", secret: true)
        XCTAssertEqual(reason { try self.coordinator.startCollection() }, "server", "a different PaymentIntent is refused")
        world.http.responses["prepared-payment-intent"] = #"{"id":"pi_1","status":"succeeded","paid":true,"clientSecret":"s"}"#
        XCTAssertEqual(reason { try self.coordinator.startCollection() }, "server")
        XCTAssertEqual(world.state.attempt?.paymentIntentId, "pi_1")
    }

    // MARK: Settlement

    func testOnlyAFreshServerPaidOrConfirmedCancelClearsTheAttempt() {
        let cases: [(recover: String, cancel: String?, expected: Settlement)] = [
            (FakeServer.payment("succeeded"), nil, .paid),
            (FakeServer.payment("requires_payment_method"), FakeServer.payment("canceled"), .canceled),
            (FakeServer.payment("requires_payment_method"), FakeServer.payment("succeeded"), .paid),
            (FakeServer.payment("requires_payment_method"), FakeServer.payment("processing"), .retained),
            (FakeServer.payment("requires_payment_method"), FakeServer.payment("canceled", id: "pi_2"), .retained),
            (FakeServer.payment("succeeded", id: "pi_2"), FakeServer.payment("requires_payment_method"), .retained),
            (FakeServer.payment("requires_payment_method"), nil, .retained),
        ]
        for (recover, cancel, expected) in cases {
            retain()
            world.http.responses["prepared-recover"] = recover
            world.http.responses["prepared-cancel"] = cancel
            XCTAssertEqual(coordinator.settle(), expected, "\(recover) \(cancel ?? "error")")
            XCTAssertEqual(world.state.attempt == nil, expected != .retained)
            XCTAssertEqual(world.state.session, world.session)
        }
    }

    // MARK: Startup recovery

    func testARetainedAttemptBlocksCaptureAndIsClearedOnlyByServerAuthority() {
        for (cancel, clears) in [(FakeServer.payment("canceled"), true), (FakeServer.payment("processing"), false)] {
            retain()
            recovered = 0
            world.http.responses["prepared-cancel"] = cancel
            XCTAssertFalse(capture())
            XCTAssertEqual(world.state.attempt == nil, clears)
            XCTAssertEqual(recovered, clears ? 1 : 0)
            XCTAssertEqual(world.state.session?.expiresAt, 1_000 + 900_000, "the retained session is renewed from the same cookie")
        }
        XCTAssertTrue(capture() == false && coordinator.renewSession() == false, "still locked")
    }

    func testATicketOnlyAttemptResolvesThroughCreationStatusAtStartupAndAfterASale() {
        let uncreated = #"{"creation":"UNCREATED"}"#, created = #"{"creation":"CREATED"}"#
        let cases: [(creation: String?, recover: String, expected: Settlement, actions: [String])] = [
            (uncreated, FakeServer.payment("requires_payment_method"), .canceled, ["prepared-creation-status"]),
            (created, FakeServer.payment("requires_payment_method"), .canceled,
             ["prepared-creation-status", "prepared-payment-intent", "prepared-recover:pi_1", "prepared-cancel:pi_1"]),
            (created, FakeServer.payment("succeeded"), .paid, ["prepared-creation-status", "prepared-payment-intent", "prepared-recover:pi_1"]),
            (nil, FakeServer.payment("requires_payment_method"), .retained, ["prepared-creation-status"]),
        ]
        for (creation, recover, expected, actions) in cases {
            for startup in [true, false] {
                retain(paymentIntentId: nil)
                world.http.responses["prepared-creation-status"] = creation
                world.http.responses["prepared-recover"] = recover
                let before = world.actions.count
                if startup { XCTAssertFalse(capture()) } else { XCTAssertEqual(coordinator.settle(), expected) }
                XCTAssertEqual(Array(world.actions.dropFirst(before)), actions)
                XCTAssertEqual(world.state.attempt == nil, expected != .retained, "\(creation ?? "error") startup=\(startup)")
            }
        }
    }

    func testRecoveryNeverRunsForATicketlessMarkerOrADifferentBrowserSession() {
        retain(paymentIntentId: nil, ticket: false)
        XCTAssertFalse(capture())
        retain()
        world.cookie = "other"
        XCTAssertFalse(capture())
        XCTAssertTrue(world.actions.isEmpty)
        XCTAssertNotNil(world.state.attempt)
    }

    func testAStoreFailurePoisonsTheCoordinatorUntilRestart() {
        world.state = DurableState(session: world.session)
        world.keychain.failWrites = true
        XCTAssertEqual(reason { try self.coordinator.admit(Fixtures.reference) }, "store_unavailable")
        world.keychain.failWrites = false
        XCTAssertEqual(reason { try self.coordinator.admit(Fixtures.reference) }, "poisoned")
        XCTAssertFalse(capture())
        XCTAssertEqual(coordinator.settle(), .retained)
        XCTAssertTrue(world.actions.isEmpty)
    }
}
