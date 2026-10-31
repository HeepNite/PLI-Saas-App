import XCTest
@testable import KioskNative

/// The warm M2 link: exact reader only, bounded retries, first pairing, and no payment work.
final class ReaderConnectionOwnerTests: XCTestCase {
    private let sdk = FakeSDK()
    private let permissions = FakePermissions(granted: true)
    private let scheduler = FakeScheduler()
    private let events = NativeWebEvents()
    private var posted = [String]()
    private var paired = [String]()

    private func makeOwner(pinned: String? = Fixtures.readerId) -> ReaderConnectionOwner {
        events.bind(ClosureWebEventTarget { [unowned self] in posted.append($0) })
        return ReaderConnectionOwner(
            sdk: sdk, permissions: permissions, policy: Fixtures.policy, pinnedReaderId: pinned, scheduler: scheduler, events: events,
            fetchToken: { "tok" }, execute: { $0() }, onPaired: { [unowned self] in paired.append($0) }
        )
    }

    private func ready(_ owner: ReaderConnectionOwner) {
        owner.start()
        sdk.publish(Fixtures.exact)
        sdk.completeConnection(Fixtures.exact)
        XCTAssertEqual(owner.state, .ready)
    }

    private var statuses: [String] { posted.compactMap { $0.components(separatedBy: "\"status\":\"").dropFirst().first?.components(separatedBy: "\"").first } }
    private var retryDelays: [Int64] { scheduler.pendingDelays { $0 != ReaderConnectionOwner.attemptTimeoutMs } }
    private func fireRetry() { scheduler.advance(byMs: retryDelays.min() ?? 0) }
    private func reader(id: String?, serial: String = Fixtures.serial, location: String? = Fixtures.location) -> SDKReader {
        SDKReader(stripeId: id, serialNumber: serial, deviceType: "stripe_m2", locationId: location)
    }

    func testStartConnectsOnlyTheExactReaderWithAutoReconnectAndNoPaymentWork() throws {
        let owner = makeOwner()
        owner.start()
        XCTAssertEqual(sdk.lastDiscoveryTimeout, 10)
        sdk.publish()
        sdk.publish(reader(id: "tmr_other"), reader(id: Fixtures.readerId, serial: "STRM2OTHER"))
        XCTAssertEqual(sdk.connections, 0, "empty or foreign scans keep discovering")
        sdk.publish(Fixtures.exact)
        XCTAssertEqual(sdk.lastConnect?.locationId, Fixtures.location)
        XCTAssertEqual(sdk.lastConnect?.autoReconnect, true)
        sdk.completeConnection(Fixtures.exact)
        XCTAssertEqual(owner.readyReaderId(), Fixtures.readerId)
        XCTAssertEqual(statuses, ["connecting", "connected"])
        XCTAssertEqual(try sdk.token(), "tok")
        XCTAssertTrue(sdk.paymentOperations.isEmpty)
    }

    func testFailuresRetryForeverWithFiveTenTwentySecondBackoffAndSuccessResetsIt() {
        let owner = makeOwner()
        owner.start()
        var delays = [Int64]()
        for _ in 0..<4 {
            sdk.failDiscovery()
            XCTAssertEqual(owner.state, .waitingRetry)
            delays += retryDelays
            fireRetry()
        }
        XCTAssertEqual(delays, [5_000, 10_000, 20_000, 20_000])
        XCTAssertEqual(sdk.discoveries, 5)
        sdk.publish(Fixtures.exact)
        sdk.completeConnection(Fixtures.exact)
        sdk.dropConnection()
        XCTAssertEqual(retryDelays, [5_000])
    }

    func testTheCancelledDiscoveryReportedAsFailedDoesNotAbortTheConnection() {
        sdk.reportsCancelledDiscoveryAsFailure = true
        let owner = makeOwner()
        owner.start()
        sdk.publish(Fixtures.exact)
        XCTAssertEqual(owner.state, .connecting, "the SDK finishing the scan we cancelled is not an attempt failure")
        XCTAssertTrue(retryDelays.isEmpty)
        sdk.completeConnection(Fixtures.exact)
        XCTAssertEqual(owner.readyReaderId(), Fixtures.readerId)
        XCTAssertEqual(statuses, ["connecting", "connected"])
    }

    func testAHungDiscoveryOrConnectionIsBoundedByTheAttemptDeadline() {
        let owner = makeOwner()
        owner.start()
        scheduler.advance(byMs: ReaderConnectionOwner.attemptTimeoutMs)
        XCTAssertEqual(owner.state, .waitingRetry)
        fireRetry()
        sdk.publish(Fixtures.exact)
        scheduler.advance(byMs: ReaderConnectionOwner.attemptTimeoutMs)
        XCTAssertEqual(owner.state, .waitingRetry)
        sdk.completeConnection(Fixtures.exact)
        XCTAssertEqual(sdk.disconnects, 1, "a late connection of an abandoned attempt is released")
        XCTAssertNil(owner.readyReaderId())
    }

    func testReconnectAndDisconnectEventsDriveStatusAndRetry() {
        let owner = makeOwner()
        ready(owner)
        owner.sdkReaderDidStartReconnect()
        XCTAssertNil(owner.readyReaderId())
        owner.sdkReaderDidSucceedReconnect()
        XCTAssertEqual(owner.readyReaderId(), Fixtures.readerId)
        sdk.dropConnection()
        sdk.dropConnection()
        XCTAssertEqual(retryDelays, [5_000], "one retry per loss")
        XCTAssertEqual(statuses, ["connecting", "connected", "connecting", "connected", "disconnected"])
    }

    func testInvalidationDisconnectsAndNothingRevivesIt() {
        let owner = makeOwner()
        ready(owner)
        sdk.dropConnection()
        owner.invalidate()
        XCTAssertEqual(owner.state, .stopped)
        XCTAssertEqual(sdk.disconnects, 1)
        scheduler.advance(byMs: 60_000)
        owner.sdkReaderDidRequestInput()
        XCTAssertEqual(sdk.discoveries, 1)
        XCTAssertFalse(posted.contains { $0.contains("awaiting_card") })
    }

    func testStartReleasesAnOlderLinkAndInputRequestsBecomeTheAwaitingCardPrompt() {
        sdk.connectedReader = Fixtures.exact
        let owner = makeOwner()
        ready(owner)
        XCTAssertEqual(sdk.disconnects, 1)
        owner.sdkReaderDidRequestInput()
        XCTAssertTrue(posted.last!.contains("\"prompt\":\"awaiting_card\""))
    }

    func testReadyReaderIdRequiresTheLiveLinkToStillMatch() {
        let owner = makeOwner()
        ready(owner)
        sdk.connectedReader = reader(id: "tmr_other")
        XCTAssertNil(owner.readyReaderId())
        sdk.connectedReader = nil
        XCTAssertNil(owner.readyReaderId())
    }

    func testPermissionIsRequestedOnceAndADenialKeepsRetrying() {
        permissions.granted = false
        let owner = makeOwner()
        owner.start()
        XCTAssertEqual(owner.state, .permissionRequired)
        owner.onBluetoothPermissionResult(false)
        fireRetry()
        XCTAssertEqual(permissions.requests, 1)
        XCTAssertEqual(owner.state, .waitingRetry)
        permissions.granted = true
        fireRetry()
        XCTAssertEqual(owner.state, .discovering)
    }

    func testFirstPairingLearnsTheIdFromTheLiveConnectionAndPinsIt() {
        let owner = makeOwner(pinned: nil)
        owner.start()
        sdk.publish(reader(id: nil, serial: "STRM2OTHER", location: nil))
        XCTAssertEqual(sdk.connections, 0, "foreign hardware is never paired")
        sdk.publish(Fixtures.unregistered)
        sdk.completeConnection(reader(id: "tmr_new"))
        XCTAssertEqual(paired, ["tmr_new"])
        XCTAssertEqual(owner.readyReaderId(), "tmr_new")
        sdk.dropConnection()
        fireRetry()
        sdk.publish(Fixtures.exact)
        XCTAssertEqual(sdk.connections, 1, "the learned id stays pinned")
    }

    func testAConnectionReportingOtherHardwareOrLocationIsReleased() {
        for connected in [reader(id: "tmr_new", serial: "STRM2OTHER"), reader(id: "tmr_new", location: "tml_x"), reader(id: nil)] {
            let owner = makeOwner(pinned: nil)
            owner.start()
            sdk.publish(Fixtures.unregistered)
            let disconnects = sdk.disconnects
            sdk.completeConnection(connected)
            XCTAssertEqual(sdk.disconnects, disconnects + 1)
            XCTAssertEqual(owner.state, .waitingRetry)
            XCTAssertTrue(paired.isEmpty)
            owner.invalidate()
        }
    }
}
