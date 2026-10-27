package com.pli.kiosk.android

import org.junit.Test
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WebSessionReadinessTest {
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val terminal = "${origin.value}/staff/terminal"
    private val cookie = "pli_terminal_session=browser-session"

    @Test
    fun deniedOrForeignCompletionNeverReadsCookies() {
        val store = MemoryStore()
        var reads = 0
        val readiness = readiness(store) { reads++; cookie }

        assertFalse(readiness.capture("https://foreign.invalid/staff/terminal", terminal))
        assertFalse(readiness.capture(terminal, "$terminal?redirect"))
        assertEquals(0, reads)
        assertNull(store.state.session)
    }

    @Test
    fun exactCompletionWithMissingOrMalformedCookieIsNotReadyAndLeaksNothing() {
        listOf<String?>(null, "pli_terminal_session=\"quoted\"").forEach { header ->
            val store = MemoryStore()
            val readiness = readiness(store) { header }

            assertFalse(readiness.capture(terminal, terminal))
            assertNull(store.state.session)
            assertEquals(0, store.writes)
        }
    }

    @Test
    fun validCookiePersistsAndReadsBackBeforeReadiness() {
        val store = MemoryStore()
        val readiness = readiness(store) { cookie }

        assertTrue(readiness.capture(terminal, terminal))
        assertTrue(readiness.ready)
        assertEquals(1, store.writes)
        assertEquals(origin.value, store.state.session?.origin)
        assertNull(store.state.attempt)
    }

    @Test
    fun currentSessionRevalidatesTheCapturedEncryptedSessionBeforeHostUse() {
        val clock = MutableClock(1_000_000L)
        val store = MemoryStore()
        val readiness = readiness(store, clock) { cookie }

        assertTrue(readiness.capture(terminal, terminal))
        val captured = requireNotNull(store.state.session)
        assertEquals(captured, readiness.currentSession())

        store.state = DurableState()
        assertNull(readiness.currentSession())
        store.state = DurableState(session = captured.copy(cookie = "changed"))
        assertNull(readiness.currentSession())
        store.state = DurableState(session = captured.copy(expiresAt = clock.now))
        assertNull(readiness.currentSession())
    }

    @Test
    fun duplicateCookieCompletionRetainsFreshMatchingSessionWithoutExtendingItsTtl() {
        val clock = MutableClock(1_000_000L)
        val store = MemoryStore()
        val readiness = readiness(store, clock) { cookie }

        assertTrue(readiness.capture(terminal, terminal))
        val originalExpiry = requireNotNull(store.state.session).expiresAt
        clock.advanceBy(60_000L)

        assertTrue(readiness.capture(terminal, terminal))
        assertEquals(1, store.writes)
        assertEquals(originalExpiry, store.state.session?.expiresAt)
        assertTrue(readiness.ready)
    }

    @Test
    fun retainedRecoveryRunsOffThePageCallbackAndSignalsAReadyReloadAfterPaid() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "succeeded", true))
        val tasks = mutableListOf<() -> Unit>()
        val stages = mutableListOf<RetainedRecoveryStage>()
        var readyReloads = 0
        val readiness = readiness(
            store,
            clock,
            preparedApi,
            OperatorBackgroundExecutor { tasks += it },
            { readyReloads++; true },
            { stages += it },
        ) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertTrue(preparedApi.recoveries.isEmpty())
        assertEquals(original, store.state)
        assertEquals(1, tasks.size)
        assertEquals(listOf(RetainedRecoveryStage.SCHEDULED), stages)

        tasks.single().invoke()
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertNull(store.state.attempt)
        assertEquals(1, readyReloads)
        assertEquals(
            listOf(
                RetainedRecoveryStage.SCHEDULED,
                RetainedRecoveryStage.SESSION_RENEWED,
                RetainedRecoveryStage.SERVER_PAID,
                RetainedRecoveryStage.PAID_COMMITTED,
                RetainedRecoveryStage.RELOAD_REQUESTED,
            ),
            stages,
        )
        assertFalse(
            readiness.capture(terminal, terminal),
            "the recovery-owning readiness must stay spent while Activity recreation is queued",
        )
    }

    @Test
    fun knownPreparedPaymentRecoversPaidWithTheExactBrowserSessionBeforeReadiness() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "succeeded", true))
        val readiness = readiness(store, clock, preparedApi) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertNull(store.state.attempt)
        assertTrue(requireNotNull(store.state.session).expiresAt > clock.now)
        assertFalse(readiness.ready)
        assertFalse(readiness.capture(terminal, terminal))
        assertNull(readiness.currentSession())
    }

    @Test
    fun freshUncreatedTicketOnlyStatusClearsOnlyTheExactOriginalAttemptAfterReadback() {
        val clock = MutableClock(1_000_000L)
        val original = retainedTicketOnlyPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(creationStatus = PreparedCreationStatus.UNCREATED)
        val tasks = mutableListOf<() -> Unit>()
        var readyReloads = 0
        val readiness = readiness(
            store, clock, preparedApi, OperatorBackgroundExecutor { tasks += it }, { readyReloads++; true },
        ) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(1, tasks.size)
        assertEquals(original, store.state)
        tasks.single().invoke()

        assertEquals(listOf(original.attempt?.ticket), preparedApi.creationStatusTickets)
        assertEquals(
            DurableState(StaffSessionTransport(origin) { clock.now }.importBrowserSession(cookie)),
            store.state,
        )
        assertEquals(1, readyReloads)
        assertFalse(readiness.ready)
        assertFalse(readiness.capture(terminal, terminal))
    }

    @Test
    fun freshUncreatedLateCallbackRejectsChangedBrowserCookieAuthority() {
        val clock = MutableClock(1_000_000L)
        val original = retainedTicketOnlyPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val tasks = mutableListOf<() -> Unit>()
        var browserCookie = cookie
        var readyReloads = 0
        val readiness = readiness(
            store,
            clock,
            RecordingPreparedApi(creationStatus = PreparedCreationStatus.UNCREATED),
            OperatorBackgroundExecutor { tasks += it },
            { readyReloads++; true },
        ) { browserCookie }

        assertFalse(readiness.capture(terminal, terminal))
        browserCookie = "pli_terminal_session=replacement-session"
        tasks.single().invoke()

        assertEquals(original, store.state)
        assertEquals(0, readyReloads)
        assertFalse(readiness.capture(terminal, terminal))
    }

    @Test
    fun ticketOnlyLateUncreatedAfterActivityOwnerIsSpentRestoresOriginalAndPoisons() {
        val clock = MutableClock(1_000_000L)
        val original = retainedTicketOnlyPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val tasks = mutableListOf<() -> Unit>()
        var ownerAvailable = true
        var acceptedReloads = 0
        val readiness = readiness(
            store = store,
            clock = clock,
            preparedApi = RecordingPreparedApi(creationStatus = PreparedCreationStatus.UNCREATED),
            backgroundExecutor = OperatorBackgroundExecutor { tasks += it },
            onRecoveryReady = {
                if (ownerAvailable) {
                    acceptedReloads++
                    true
                } else false
            },
            readCookie = { cookie },
        )

        assertFalse(readiness.capture(terminal, terminal))
        ownerAvailable = false
        tasks.single().invoke()

        assertEquals(original, store.state)
        assertEquals(0, acceptedReloads)
        assertFalse(readiness.capture(terminal, terminal))
    }

    @Test
    fun createdMalformedOrTransportStatusPreservesTheTicketOnlyAttemptAndPoisonsReadiness() {
        listOf(
            RecordingPreparedApi(creationStatus = PreparedCreationStatus.CREATED),
            RecordingPreparedApi(creationFailure = IOException("invalid response")),
        ).forEach { preparedApi ->
            val clock = MutableClock(1_000_000L)
            val original = retainedTicketOnlyPreparedState(clock, sessionExpiry = clock.now - 1)
            val store = MemoryStore(original)
            var readyReloads = 0
            val readiness = readiness(
                store = store,
                clock = clock,
                preparedApi = preparedApi,
                onRecoveryReady = { readyReloads++; true },
                readCookie = { cookie },
            )

            assertFalse(readiness.capture(terminal, terminal))
            assertEquals(original, store.state)
            assertEquals(0, readyReloads)
            assertFalse(readiness.capture(terminal, terminal))
            assertEquals(original, store.state)
            assertEquals(0, readyReloads)
        }
    }

    @Test
    fun ticketOnlyStatusLateCallbackStateChangeOrReadbackFailureRestoresOriginalAttempt() {
        val clock = MutableClock(1_000_000L)
        val original = retainedTicketOnlyPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(creationStatus = PreparedCreationStatus.UNCREATED).apply {
            onCreationStatus = { store.state = DurableState(store.state.session, store.state.attempt?.copy(ticket = store.state.attempt?.ticket?.copy(value = "changed"))) }
        }
        val tasks = mutableListOf<() -> Unit>()
        val readiness = readiness(store, clock, preparedApi, OperatorBackgroundExecutor { tasks += it }) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        tasks.single().invoke()

        assertEquals(original, store.state)
        assertFalse(readiness.capture(terminal, terminal))

        val failingStore = MemoryStore(original, readbackMismatch = true)
        val failingReadiness = readiness(
            failingStore,
            clock,
            RecordingPreparedApi(creationStatus = PreparedCreationStatus.UNCREATED),
        ) { cookie }
        assertFalse(failingReadiness.capture(terminal, terminal))
        assertEquals(original, failingStore.state)
        assertFalse(failingReadiness.capture(terminal, terminal))
    }

    @Test
    fun freshUnresolvedRecoveryRetainsTheExactAttemptAndRunsOnlyOnce() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "requires_payment_method", false))
        val readiness = readiness(store, clock, preparedApi) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(original.attempt, store.state.attempt)
        assertTrue(requireNotNull(store.state.session).expiresAt > clock.now)
        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertFalse(readiness.ready)
    }

    @Test
    fun startupRolloverCancelsAConfirmedNotChargedAttemptAndClearsItDurably() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(
            PaymentResult("pi_retained", "requires_payment_method", false),
            cancelResult = PaymentResult("pi_retained", "canceled", false),
        )
        val stages = mutableListOf<RetainedRecoveryStage>()
        var readyReloads = 0
        val readiness = readiness(store, clock, preparedApi, onRecoveryReady = { readyReloads++; true }, onRecoveryStage = { stages += it }) { cookie }

        assertFalse(readiness.capture(terminal, terminal))

        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertEquals(listOf("pi_retained"), preparedApi.cancels)
        assertNull(store.state.attempt)
        assertTrue(requireNotNull(store.state.session).expiresAt > clock.now)
        assertEquals(1, readyReloads)
        assertEquals(
            listOf(
                RetainedRecoveryStage.SCHEDULED,
                RetainedRecoveryStage.SESSION_RENEWED,
                RetainedRecoveryStage.SERVER_PENDING,
                RetainedRecoveryStage.SERVER_CANCELED,
                RetainedRecoveryStage.RELOAD_REQUESTED,
            ),
            stages,
        )
    }

    @Test
    fun startupRolloverKeepsTheAttemptWhenCancelIsAmbiguousOrFails() {
        listOf(
            RecordingPreparedApi(PaymentResult("pi_retained", "requires_payment_method", false), cancelResult = PaymentResult("pi_retained", "processing", false)),
            RecordingPreparedApi(PaymentResult("pi_retained", "requires_payment_method", false), cancelFailure = IOException("offline")),
        ).forEach { preparedApi ->
            val clock = MutableClock(1_000_000L)
            val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
            val store = MemoryStore(original)
            var readyReloads = 0
            val readiness = readiness(store, clock, preparedApi, onRecoveryReady = { readyReloads++; true }) { cookie }

            assertFalse(readiness.capture(terminal, terminal))

            assertEquals(listOf("pi_retained"), preparedApi.cancels)
            assertEquals(original.attempt, store.state.attempt)
            assertEquals(0, readyReloads)
            assertFalse(readiness.ready)
        }
    }

    @Test
    fun startupRolloverCancelThatFindsThePaymentPaidUsesThePaidRollover() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(
            PaymentResult("pi_retained", "requires_payment_method", false),
            cancelResult = PaymentResult("pi_retained", "succeeded", true),
        )
        val stages = mutableListOf<RetainedRecoveryStage>()
        val readiness = readiness(store, clock, preparedApi, onRecoveryStage = { stages += it }) { cookie }

        assertFalse(readiness.capture(terminal, terminal))

        assertNull(store.state.attempt)
        assertTrue(RetainedRecoveryStage.PAID_COMMITTED in stages)
    }

    @Test
    fun changedBrowserSessionCannotRecoverOrMutateTheRetainedAttempt() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "succeeded", true))
        val readiness = readiness(store, clock, preparedApi) { "pli_terminal_session=replacement-session" }

        assertFalse(readiness.capture(terminal, terminal))
        assertTrue(preparedApi.recoveries.isEmpty())
        assertEquals(original, store.state)
    }

    @Test
    fun failedAuthoritativeRecoveryRestoresTheOriginalDurableState() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = MemoryStore(original)
        val preparedApi = RecordingPreparedApi(failure = IOException("offline"))
        val readiness = readiness(store, clock, preparedApi) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertEquals(original, store.state)
        assertFalse(readiness.ready)
    }

    @Test
    fun paidRecoveryClearFailureRestoresTheOriginalDurableAttempt() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = FailOnWriteStore(original, failOnWrite = 2)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "succeeded", true))
        val readiness = readiness(store, clock, preparedApi) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertEquals(original, store.state)
        assertFalse(readiness.ready)
    }

    @Test
    fun exactPostCommitPaidStateIsAcceptedOnlyAfterAuthoritativeRecovery() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = PostCommitFailureStore(original)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "succeeded", true))
        val readiness = readiness(store, clock, preparedApi) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertTrue(store.attempted.none { it.attempt?.resolved == true })
        assertNull(store.state.attempt)
        assertFalse(readiness.capture(terminal, terminal))
        assertFalse(readiness.ready)
    }

    @Test
    fun paidFinalizationAndRollbackFailurePreservesAttemptAndBlocksAdmission() {
        val clock = MutableClock(1_000_000L)
        val original = retainedPreparedState(clock, sessionExpiry = clock.now - 1)
        val store = FailingFinalizationStore(original)
        val preparedApi = RecordingPreparedApi(PaymentResult("pi_retained", "succeeded", true))
        val readiness = readiness(store, clock, preparedApi) { cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(listOf("pi_retained"), preparedApi.recoveries)
        assertEquals(original.attempt, store.state.attempt)
        assertFalse(store.state.attempt?.resolved == true)
        assertFalse(readiness.capture(terminal, terminal))
        assertFalse(readiness.ready)
    }

    @Test
    fun expiredOrChangedCookieSessionIsGuardedlyReplacedButAttemptsBlockAllReplacement() {
        val clock = MutableClock(1_000_000L)
        val store = MemoryStore()
        var browserCookie = cookie
        val readiness = readiness(store, clock) { browserCookie }

        assertTrue(readiness.capture(terminal, terminal))
        clock.advanceBy(15 * 60_000L)
        assertTrue(readiness.capture(terminal, terminal))
        assertEquals(2, store.writes)

        browserCookie = "pli_terminal_session=replacement-session"
        assertTrue(readiness.capture(terminal, terminal))
        assertEquals(3, store.writes)

        store.state = store.state.copy(attempt = AttemptState(null, "association", origin.value))
        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(3, store.writes)
    }

    @Test
    fun resolvedPreparedAttemptRollsOverBeforeCapturingTheNextWebSession() {
        val retainedSession = StaffSession(origin.value, "association", "old-cookie", 900_000L)
        val retainedAttempt = AttemptState(
            AttemptTicket("ticket", 900_000L, "tmr_exact", Approved.LOCATION),
            retainedSession.association,
            retainedSession.origin,
            "pi_resolved",
            resolved = true,
            mode = AttemptMode.PREPARED,
        )
        val store = MemoryStore(DurableState(retainedSession, retainedAttempt))
        var cookieReads = 0
        val readiness = readiness(store) { cookieReads++; cookie }

        assertTrue(readiness.capture(terminal, terminal))
        assertTrue(readiness.ready)
        assertEquals(1, cookieReads)
        assertEquals(2, store.writes)
        assertNull(store.state.attempt)
        assertEquals(store.state.session, readiness.currentSession())
    }

    @Test
    fun unresolvedMismatchedOrCorruptPreparedAttemptsRemainBlocked() {
        val session = StaffSession(origin.value, "association", "old-cookie", 2_000_000L)
        val ticket = AttemptTicket("ticket", 2_000_000L, "tmr_exact", Approved.LOCATION)
        val states = listOf(
            DurableState(session, AttemptState(null, session.association, session.origin, mode = AttemptMode.PREPARED)),
            DurableState(session, AttemptState(ticket, "different-association", session.origin, "pi_resolved", true, AttemptMode.PREPARED)),
            DurableState(session, AttemptState(ticket, session.association, "https://different.invalid", "pi_resolved", true, AttemptMode.PREPARED)),
            DurableState(session, AttemptState(null, session.association, session.origin, "pi_resolved", true, AttemptMode.PREPARED)),
            DurableState(session, AttemptState(ticket, session.association, session.origin, null, true, AttemptMode.PREPARED)),
            DurableState(session, AttemptState(ticket.copy(locationId = "wrong"), session.association, session.origin, "pi_resolved", true, AttemptMode.PREPARED)),
            DurableState(session, AttemptState(ticket.copy(expiresAt = 0L), session.association, session.origin, "pi_resolved", true, AttemptMode.PREPARED)),
            StaffSession("https://foreign.invalid", "association", "old-cookie", 2_000_000L).let { foreign ->
                DurableState(foreign, AttemptState(ticket, foreign.association, foreign.origin, "pi_resolved", true, AttemptMode.PREPARED))
            },
        )

        states.forEach { original ->
            val store = MemoryStore(original)
            var cookieReads = 0
            val readiness = readiness(store) { cookieReads++; cookie }

            assertFalse(readiness.capture(terminal, terminal))
            assertEquals(0, cookieReads)
            assertEquals(0, store.writes)
            assertEquals(original, store.state)
        }
    }

    @Test
    fun rolloverReadbackFailureRestoresTheResolvedPreparedAttempt() {
        val session = StaffSession(origin.value, "association", "old-cookie", 900_000L)
        val attempt = AttemptState(
            AttemptTicket("ticket", 900_000L, "tmr_exact", Approved.LOCATION),
            session.association,
            session.origin,
            "pi_resolved",
            resolved = true,
            mode = AttemptMode.PREPARED,
        )
        val original = DurableState(session, attempt)
        val store = FailingRolloverReadbackStore(original)
        var cookieReads = 0
        val readiness = readiness(store) { cookieReads++; cookie }

        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(original, store.state)
        assertEquals(2, store.writes)
        assertEquals(0, cookieReads)
    }

    @Test
    fun retainedAttemptCorruptStateAndWriteOrReadbackFailureBlockReplacement() {
        listOf(
            MemoryStore(DurableState(attempt = AttemptState(null, "association", origin.value))),
            MemoryStore(DurableState(attempt = AttemptState(null, "association", origin.value, "pi_retained", true))),
            MemoryStore(failRead = true),
            MemoryStore(failWrite = true),
            MemoryStore(readbackMismatch = true),
        ).forEach { store ->
            var reads = 0
            val readiness = readiness(store) { reads++; cookie }

            assertFalse(readiness.capture(terminal, terminal))
            assertFalse(readiness.ready)
            if (store.state.attempt != null || store.failRead) assertEquals(0, reads)
        }
    }

    private fun readiness(
        store: StateStore,
        clock: MutableClock = MutableClock(1_000_000L),
        preparedApi: PreparedPurchaseApi? = null,
        backgroundExecutor: OperatorBackgroundExecutor = DirectOperatorBackgroundExecutor,
        onRecoveryReady: () -> Boolean = { true },
        onRecoveryStage: (RetainedRecoveryStage) -> Unit = {},
        readCookie: () -> String?,
    ): WebSessionReadiness =
        WebSessionReadiness(
            origin,
            store,
            StaffSessionTransport(origin) { clock.now },
            BrowserCookieReader { readCookie() },
            { clock.now },
            preparedApi,
            backgroundExecutor,
            onRecoveryReady,
            onRecoveryStage,
        )

    private fun retainedPreparedState(clock: MutableClock, sessionExpiry: Long): DurableState =
        retainedPreparedAttemptState(clock, sessionExpiry, "pi_retained")

    private fun retainedTicketOnlyPreparedState(clock: MutableClock, sessionExpiry: Long): DurableState =
        retainedPreparedAttemptState(clock, sessionExpiry, null)

    private fun retainedPreparedAttemptState(clock: MutableClock, sessionExpiry: Long, paymentIntentId: String?): DurableState {
        val captured = StaffSessionTransport(origin) { clock.now }.importBrowserSession(cookie)
        val session = captured.copy(expiresAt = sessionExpiry)
        return DurableState(
            session,
            AttemptState(
                AttemptTicket("ticket", clock.now + 60_000L, "tmr_exact", Approved.LOCATION),
                session.association,
                session.origin,
                paymentIntentId,
                resolved = false,
                mode = AttemptMode.PREPARED,
            ),
        )
    }

    private class RecordingPreparedApi(
        private val result: PaymentResult? = null,
        private val failure: Exception? = null,
        private val creationStatus: PreparedCreationStatus? = null,
        private val creationFailure: Exception? = null,
        private val cancelResult: PaymentResult? = null,
        private val cancelFailure: Exception? = null,
    ) : PreparedPurchaseApi {
        val recoveries = mutableListOf<String>()
        val cancels = mutableListOf<String>()
        val creationStatusTickets = mutableListOf<AttemptTicket>()
        var onCreationStatus: () -> Unit = {}
        override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String) = error("unexpected attempt")
        override fun preparedPaymentIntent(
            session: StaffSession,
            ticket: AttemptTicket,
            paymentIntentId: String?,
        ) = error("unexpected payment preparation")
        override fun preparedRecover(
            session: StaffSession,
            ticket: AttemptTicket,
            paymentIntentId: String,
        ): PaymentResult {
            recoveries += paymentIntentId
            failure?.let { throw it }
            return requireNotNull(result)
        }
        override fun preparedCancel(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult {
            cancels += paymentIntentId
            cancelFailure?.let { throw it }
            return cancelResult ?: throw UnsupportedOperationException("cancel unsupported")
        }
        override fun preparedCreationStatus(session: StaffSession, ticket: AttemptTicket): PreparedCreationStatus {
            creationStatusTickets += ticket
            onCreationStatus()
            creationFailure?.let { throw it }
            return requireNotNull(creationStatus)
        }
    }

    private class MutableClock(var now: Long) {
        fun advanceBy(millis: Long) {
            now += millis
        }
    }

    private class PostCommitFailureStore(var state: DurableState) : StateStore {
        private var writes = 0
        val attempted = mutableListOf<DurableState>()
        override fun read() = state
        override fun write(state: DurableState) {
            attempted += state
            writes++
            this.state = state
            if (writes == 2) throw IOException("post-commit verification failure")
        }
    }

    private class FailingFinalizationStore(var state: DurableState) : StateStore {
        private var writes = 0
        override fun read() = state
        override fun write(state: DurableState) {
            writes++
            if (writes >= 2) throw IOException("finalization unavailable")
            this.state = state
        }
    }

    private class FailOnWriteStore(var state: DurableState, private val failOnWrite: Int) : StateStore {
        private var writeAttempts = 0
        override fun read() = state
        override fun write(state: DurableState) {
            writeAttempts++
            if (writeAttempts == failOnWrite) throw IOException("fixture write failure")
            this.state = state
        }
    }

    private class FailingRolloverReadbackStore(var state: DurableState) : StateStore {
        private var reads = 0
        var writes = 0
        override fun read(): DurableState {
            reads++
            if (reads == 3) throw IOException("rollover readback unavailable")
            return state
        }
        override fun write(state: DurableState) {
            writes++
            this.state = state
        }
    }

    private class MemoryStore(
        var state: DurableState = DurableState(),
        val failRead: Boolean = false,
        val failWrite: Boolean = false,
        val readbackMismatch: Boolean = false,
    ) : StateStore {
        var writes = 0
        private var wrote = false
        override fun read(): DurableState {
            if (failRead) throw IOException("fixture unavailable")
            return if (readbackMismatch && wrote) DurableState() else state
        }
        override fun write(state: DurableState) {
            if (failWrite) throw IOException("fixture write failure")
            writes++
            wrote = true
            this.state = state
        }
    }
}
