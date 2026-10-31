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
}
