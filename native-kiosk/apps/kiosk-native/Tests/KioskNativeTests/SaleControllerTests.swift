import XCTest
@testable import KioskNative

/// Money-safety cases of the one native sale over the real coordinator, with fake server, reader and clock.
final class SaleControllerTests: XCTestCase {
    private let world = World()
    private let sdk = FakeSDK()
    private let scheduler = FakeScheduler()
    private var readyReader: String? = Fixtures.readerId
    private var prompts = [CollectionPrompt]()
    private lazy var sale = SaleController(
        coordinator: world.coordinator, sdk: sdk, readyReaderId: { [unowned self] in readyReader }, scheduler: scheduler,
        execute: { $0() }, clock: { [unowned self] in scheduler.now }, onPrompt: { [unowned self] in prompts.append($0) }
    )

    override func setUp() {
        XCTAssertTrue(world.coordinator.capture {})
    }

    @discardableResult
    private func start(_ operation: String = "op-1") -> SecureBridgeState { sale.start(operation, Fixtures.reference).state }
    private func state(_ operation: String = "op-1") -> SecureBridgeState { sale.poll(operation).state }
    private func awaitingCard() {
        XCTAssertEqual(start(), .pending)
        sdk.retrieved("pi_1")
    }

    func testPaidIsReportedOnlyAfterAFreshServerPaidAndTheAttemptIsCleared() {
        awaitingCard()
        XCTAssertEqual(world.actions, ["prepared-attempt", "prepared-payment-intent"])
        XCTAssertEqual(sdk.retrievedSecrets, ["pi_1_secret"])
        sdk.collected("pi_1")
        XCTAssertEqual(prompts, [.processing])
        world.http.responses["prepared-recover"] = FakeServer.payment("succeeded")
        sdk.confirmed("pi_1")
        XCTAssertEqual(state(), .paid)
        XCTAssertEqual(world.actions.last, "prepared-recover:pi_1")
        XCTAssertNil(world.state.attempt)
        XCTAssertEqual(prompts.last, CollectionPrompt.none)
        XCTAssertTrue(scheduler.pending.isEmpty, "deadline and liveness watchdog are disarmed")
    }

    func testSdkSuccessWithoutServerPaidIsRejectedAndCanceledOnTheServer() {
        awaitingCard()
        sdk.collected("pi_1")
        sdk.confirmed("pi_1")
        XCTAssertEqual(state(), .rejected, "the SDK result alone never reports paid")
        XCTAssertEqual(world.actions.suffix(2), ["prepared-recover:pi_1", "prepared-cancel:pi_1"])
        XCTAssertNil(world.state.attempt, "confirmed canceled frees the kiosk")
        XCTAssertEqual(start("op-2"), .pending)
    }

    func testAnAmbiguousCancelKeepsTheAttemptAndTheKioskLocked() {
        world.http.responses["prepared-cancel"] = FakeServer.payment("processing")
        awaitingCard()
        sdk.collectFailed()
        XCTAssertEqual(state(), .rejected)
        XCTAssertEqual(world.state.attempt?.paymentIntentId, "pi_1")
        XCTAssertEqual(start("op-2"), .pending)
        XCTAssertEqual(state("op-2"), .rejected)
        XCTAssertEqual(world.actions.filter { $0 == "prepared-attempt" }.count, 1, "no second attempt while one is retained")
    }

    func testNoReadyReaderOrATicketForAnotherReaderNeverOpensTheReader() {
        readyReader = nil
        XCTAssertEqual(start(), .rejected)
        XCTAssertTrue(world.actions.isEmpty)
        readyReader = "tmr_other"
        XCTAssertEqual(start("op-2"), .pending)
        XCTAssertEqual(state("op-2"), .rejected)
        XCTAssertEqual(world.actions, ["prepared-attempt", "prepared-creation-status"])
        XCTAssertTrue(sdk.paymentOperations.isEmpty)
    }

    func testAReaderLostAfterTheTicketResolvesTheTicketOnlyAttemptSoTheNextSaleIsAdmitted() {
        world.http.onCall = { if $0 == "prepared-attempt" { self.readyReader = nil } }
        XCTAssertEqual(start(), .pending)
        XCTAssertEqual(state(), .rejected)
        XCTAssertEqual(world.actions, ["prepared-attempt", "prepared-creation-status"])
        XCTAssertNil(world.state.attempt, "UNCREATED clears without a restart")
        world.http.onCall = { _ in }
        readyReader = Fixtures.readerId
        XCTAssertEqual(start("op-2"), .pending)
        XCTAssertEqual(world.actions.suffix(2), ["prepared-attempt", "prepared-payment-intent"])
    }

    func testOneSaleAtATimeAndReferencesAreNeverReused() {
        awaitingCard()
        XCTAssertEqual(sale.start("op-2", Fixtures.reference).operationRef, nil)
        XCTAssertEqual(state("op-2"), .rejected)
        sdk.collectFailed()
        XCTAssertEqual(sale.start("op-1", Fixtures.reference).operationRef, nil, "a colliding reference never launches twice")
        XCTAssertEqual(sale.start("op-3", "short").operationRef, nil)
        XCTAssertEqual(world.actions.filter { $0 == "prepared-attempt" }.count, 1)
    }

    func testAForeignPaymentIntentIdFromTheSdkNeverCollects() {
        XCTAssertEqual(start(), .pending)
        sdk.retrieved("pi_other")
        XCTAssertEqual(sdk.paymentOperations, ["retrieve"])
        XCTAssertEqual(state(), .rejected)
        XCTAssertEqual(world.actions.last, "prepared-cancel:pi_1")
    }

    func testTheNinetySecondDeadlineCancelsTheReaderThenSettles() {
        awaitingCard()
        scheduler.advance(byMs: 5_000)
        _ = state() // keep the page alive
        scheduler.advance(byMs: 5_000)
        _ = state()
        for _ in 0..<16 { scheduler.advance(byMs: 5_000); _ = state() }
        XCTAssertEqual(sdk.cancelledOperations, ["collect"])
        XCTAssertEqual(state(), .rejected)
        XCTAssertNil(world.state.attempt)
    }

    func testAnExpiredCaptureIsRenewedAtAdmissionAndARefusedRenewalFailsClosedWithoutPoisoning() {
        world.now = 2_000_000
        world.cookie = "other"
        XCTAssertEqual(start(), .pending)
        XCTAssertEqual(state(), .rejected)
        XCTAssertTrue(world.actions.isEmpty)
        world.cookie = "cookie"
        XCTAssertEqual(start("op-2"), .pending)
        XCTAssertEqual(world.actions, ["prepared-attempt", "prepared-payment-intent"])
    }

    // MARK: Web abandonment

    func testASilentPageCancelsOnlyWhileTheReaderWaitsForTheCard() {
        awaitingCard()
        scheduler.advance(byMs: 9_000)
        XCTAssertEqual(state(), .pending)
        scheduler.advance(byMs: 9_000)
        XCTAssertTrue(sdk.cancelledOperations.isEmpty, "a poll keeps the sale alive")
        scheduler.advance(byMs: 1_000)
        XCTAssertEqual(sdk.cancelledOperations, ["collect"])
        XCTAssertEqual(state(), .rejected)
    }

    func testAbandonmentAfterTheCardWasReadNeverCancels() {
        awaitingCard()
        sdk.collected("pi_1")
        sale.documentRetired()
        scheduler.advance(byMs: 20_000)
        XCTAssertTrue(sdk.cancelledOperations.isEmpty)
        world.http.responses["prepared-recover"] = FakeServer.payment("succeeded")
        sdk.confirmed("pi_1")
        XCTAssertEqual(state(), .paid)
    }

    func testAbandonmentBeforeCollectionNeverOpensTheReader() {
        world.http.onCall = { if $0 == "prepared-attempt" { self.sale.documentRetired() } }
        XCTAssertEqual(start(), .pending)
        XCTAssertEqual(state(), .rejected)
        XCTAssertFalse(world.actions.contains("prepared-payment-intent"))
        XCTAssertTrue(sdk.paymentOperations.isEmpty)
    }

    func testInvalidationRejectsStopsTheReaderAndLeavesTheAttemptForStartupRecovery() {
        awaitingCard()
        sale.invalidate()
        XCTAssertEqual(sdk.cancelledOperations, ["collect"])
        XCTAssertEqual(prompts.last, CollectionPrompt.none)
        XCTAssertEqual(world.actions, ["prepared-attempt", "prepared-payment-intent"], "no settlement after lifecycle loss")
        XCTAssertEqual(world.state.attempt?.paymentIntentId, "pi_1")
        XCTAssertEqual(sale.poll("op-1").operationRef, nil)
        XCTAssertEqual(start("op-2"), .rejected)
    }

    func testDiagnosticsAreIdentifierFree() {
        var lines = [String]()
        KioskDiagnostics.sink = { lines.append($0) }
        defer { KioskDiagnostics.sink = KioskDiagnostics.defaultSink }
        awaitingCard()
        sale.documentRetired()
        world.cookie = nil
        XCTAssertEqual(start("op-2"), .pending)
        XCTAssertTrue(lines.contains("sale abandoned by web reason=document_retired action=cancel"))
        XCTAssertTrue(lines.contains("prepared cancel outcome=CANCELED"))
        XCTAssertTrue(lines.contains("retained attempt cleared reason=canceled"))
        XCTAssertTrue(lines.contains("sale session renewal refused"))
        XCTAssertFalse(lines.joined().contains("pi_1") || lines.joined().contains("op-") || lines.joined().contains("cookie") || lines.joined().contains("ticket"))
    }
}
