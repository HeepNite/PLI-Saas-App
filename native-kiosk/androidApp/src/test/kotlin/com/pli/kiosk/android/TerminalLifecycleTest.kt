package com.pli.kiosk.android

import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class TerminalLifecycleTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session-a", "cookie", now + 100_000)
    private val reader = ConnectedReader("tmr_fixture", Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    @Test
    fun collectionIsHardDisabledEvenWithFreshFakeAuthorization() {
        val terminal = FakeTerminalAdapter(reader)
        val authorization = FakeCollectionAuthorization(now + 10_000)
        val lifecycle = lifecycle(terminal, authorization)

        lifecycle.refreshAuthorization(session, reader.id)

        assertTrue(lifecycle.hasFreshContext(session, reader.id))
        assertFalse(lifecycle.collectionEnabled)
        assertEquals(0, terminal.collectionOperations)
    }

    @Test
    fun disconnectInvalidatesContextAndRequiresExplicitManualReconnect() {
        val terminal = FakeTerminalAdapter(reader)
        val lifecycle = lifecycle(terminal, FakeCollectionAuthorization(now + 10_000))
        lifecycle.refreshAuthorization(session, reader.id)

        terminal.reader = null
        lifecycle.onReaderDisconnected()

        assertTrue(lifecycle.requiresManualReconnect)
        assertFalse(lifecycle.hasFreshContext(session, reader.id))
        assertEquals(0, terminal.manualReconnectCalls)

        terminal.reconnectReader = reader
        lifecycle.manualReconnect()

        assertEquals(1, terminal.manualReconnectCalls)
        assertFalse(lifecycle.requiresManualReconnect)
        assertFalse(lifecycle.hasFreshContext(session, reader.id))
        assertFalse(lifecycle.collectionEnabled)
    }

    @Test
    fun everyInvalidationTriggerRejectsTheStaleContextWithoutErasingAttempt() {
        val attempt = AttemptState(
            AttemptTicket("signed-recipient-binding-fixture", now + 20_000, reader.id, Approved.LOCATION),
            session.association,
            origin.value,
            paymentIntentId = "pi_known",
        )
        val triggers: List<(CollectionLifecycleCoordinator) -> Unit> = listOf(
            { it.onReaderDisconnected() },
            { it.onApplicationBackgrounded() },
            { it.onAuthenticatedSessionChanged() },
            { it.onConfiguredReaderChanged() },
            { it.onObservedReaderChanged() },
            { it.onContextExpired() },
        )

        triggers.forEach { trigger ->
            val lifecycle = lifecycle(
                FakeTerminalAdapter(reader),
                FakeCollectionAuthorization(now + 10_000),
                unresolvedAttempt = { attempt },
            )
            lifecycle.refreshAuthorization(session, reader.id)

            trigger(lifecycle)

            assertFalse(lifecycle.hasFreshContext(session, reader.id))
            assertFalse(lifecycle.collectionEnabled)
            assertEquals("pi_known", lifecycle.knownAttemptId)
            assertEquals("signed-recipient-binding-fixture", attempt.ticket?.value)
        }
    }

    @Test
    fun backgroundResumeNeedsFreshAuthorizationAndCurrentReaderAndSessionValidation() {
        val terminal = FakeTerminalAdapter(reader)
        val authorization = FakeCollectionAuthorization(now + 10_000)
        val lifecycle = lifecycle(terminal, authorization)
        lifecycle.refreshAuthorization(session, reader.id)

        lifecycle.onApplicationBackgrounded()
        lifecycle.onApplicationResumed()

        assertFalse(lifecycle.hasFreshContext(session, reader.id))
        lifecycle.refreshAuthorization(session, reader.id)
        assertTrue(lifecycle.hasFreshContext(session, reader.id))

        terminal.reader = reader.copy(id = "tmr_changed")
        assertFalse(lifecycle.hasFreshContext(session, reader.id))
        assertFalse(lifecycle.collectionEnabled)
    }

    @Test
    fun staleExpiryAndChangedSessionOrConfiguredReaderAreRejected() {
        var clock = now
        val terminal = FakeTerminalAdapter(reader)
        val authorization = FakeCollectionAuthorization(now + 1)
        val lifecycle = CollectionLifecycleCoordinator(terminal, authorization, { clock })
        lifecycle.refreshAuthorization(session, reader.id)

        clock += 1
        assertFalse(lifecycle.hasFreshContext(session, reader.id))

        authorization.expiresAt = clock + 10_000
        lifecycle.refreshAuthorization(session, reader.id)
        assertFalse(lifecycle.hasFreshContext(session.copy(association = "session-b"), reader.id))
        assertFalse(lifecycle.hasFreshContext(session, "tmr_other"))
    }

    @Test
    fun manualReconnectRejectsAbsentOrMismatchedReaderAndNeverRestoresCachedContext() {
        val terminal = FakeTerminalAdapter(null)
        val lifecycle = lifecycle(terminal, FakeCollectionAuthorization(now + 10_000))
        lifecycle.onReaderDisconnected()

        lifecycle.manualReconnect()
        assertTrue(lifecycle.requiresManualReconnect)

        terminal.reconnectReader = reader.copy(serial = "wrong")
        lifecycle.manualReconnect()
        assertFalse(lifecycle.requiresManualReconnect)
        assertFalse(lifecycle.hasFreshContext(session, reader.id))
    }

    @Test
    fun knownAttemptRecoveryUsesTheExistingReadOnlyCoordinatorPath() {
        val store = MemoryStore(DurableState(session, AttemptState(
            AttemptTicket("ticket", now + 20_000, reader.id, Approved.LOCATION),
            session.association,
            origin.value,
            paymentIntentId = "pi_known",
        )))
        val api = RecoveryOnlyApi()
        val coordinator = PurchaseCoordinator(origin, store, api, { now })

        assertEquals(Outcome.PAID, coordinator.recoverKnownAttempt())
        assertEquals(listOf("pi_known"), api.recoveries)
        assertEquals(0, api.prepares)
    }

    private fun lifecycle(
        terminal: FakeTerminalAdapter,
        authorization: FakeCollectionAuthorization,
        unresolvedAttempt: () -> AttemptState? = { null },
    ) = CollectionLifecycleCoordinator(terminal, authorization, { now }, unresolvedAttempt)

    private class FakeTerminalAdapter(initialReader: ConnectedReader?) : TerminalAdapter {
        var reader = initialReader
        var reconnectReader: ConnectedReader? = null
        var manualReconnectCalls = 0
        var collectionOperations = 0

        override fun currentReader(): ConnectedReader? = reader

        override fun manualReconnect(): ConnectedReader? {
            manualReconnectCalls++
            reader = reconnectReader
            return reader
        }
    }

    private class FakeCollectionAuthorization(var expiresAt: Long) : CollectionAuthorization {
        override fun authorize(session: StaffSession, reader: ConnectedReader): ServerAuthorizedCollectionContext =
            ServerAuthorizedCollectionContext("authorization", session.association, reader.id, expiresAt)
    }

    private class MemoryStore(private var state: DurableState) : StateStore {
        override fun read(): DurableState = state
        override fun write(state: DurableState) { this.state = state }
    }

    private class RecoveryOnlyApi : PurchaseApi {
        var prepares = 0
        val recoveries = mutableListOf<String>()
        override fun lookup(session: StaffSession, phone: String): StudentLookupResult = error("lookup must not run")
        override fun preflight(session: StaffSession) = Unit
        override fun issue(session: StaffSession, phone: String): AttemptTicket = error("issue must not run")
        override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult {
            prepares++
            error("prepare must not run")
        }
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult {
            recoveries += id
            return PaymentResult(id, "succeeded", true)
        }
    }
}
