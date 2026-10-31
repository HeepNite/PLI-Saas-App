package com.pli.kiosk.android

import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class FoundationTest {
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val now = 1_000_000L
    private val session = StaffSession(origin.value, "test-session", "a".repeat(43), now + 100_000)
    private val ticket = AttemptTicket("opaque-ticket", now + 60_000, "tmr_liveFixture", Approved.LOCATION)

    private class MemoryStore(var state: DurableState = DurableState()) : StateStore {
        var fail = false
        override fun read(): DurableState {
            if (fail) throw IOException("fixture")
            return state
        }
        override fun write(state: DurableState) {
            if (fail) throw IOException("fixture")
            this.state = state
        }
    }

    private inner class PreparedApi : PreparedPurchaseApi {
        var attempts = 0
        val paymentIds = mutableListOf<String?>()
        val recoveries = mutableListOf<String>()
        var cancels = 0
        var creationStatusRequests = 0
        var result = PaymentResult("pi_fixture", "requires_payment_method", false, "secret_fixture")
        var onAttempt: () -> Unit = {}
        var onPayment: () -> Unit = {}
        var failAttempt = false
        var failPayment = false
        override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String): AttemptTicket {
            attempts++
            onAttempt()
            if (failAttempt) throw IOException("lost response")
            return ticket
        }
        override fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String?): PaymentResult {
            paymentIds += paymentIntentId
            onPayment()
            if (failPayment) throw IOException("offline")
            return result
        }
        override fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult {
            recoveries += paymentIntentId
            return result
        }
        override fun preparedCreationStatus(session: StaffSession, ticket: AttemptTicket): PreparedCreationStatus {
            creationStatusRequests++
            return PreparedCreationStatus.UNCREATED
        }
        override fun preparedCancel(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult {
            cancels++
            return PaymentResult(paymentIntentId, "canceled", false)
        }
    }

    private val reference = "A".repeat(43)

    private fun coordinator(store: StateStore, prepared: PreparedApi = PreparedApi(), time: Long = now) =
        PurchaseCoordinator(origin, store, prepared) { time }

    private fun admitted(store: MemoryStore, prepared: PreparedApi) =
        coordinator(store, prepared).also { assertEquals(Outcome.PENDING, it.startPrepared(reference)) }

    @Test fun ticketIsDurableBeforeExplicitCollectionPreparation() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        prepared.onPayment = { assertEquals(ticket, store.state.attempt?.ticket) }
        val c = admitted(store, prepared)
        assertEquals(ticket, store.state.attempt?.ticket)
        assertNull(store.state.attempt?.paymentIntentId)
        assertTrue(prepared.paymentIds.isEmpty())
        c.startCollection()
        assertEquals("pi_fixture", store.state.attempt?.paymentIntentId)
        assertEquals(1, prepared.attempts)
    }

    @Test fun restartWithKnownIdOnlyRecoversEvenAfterExpiry() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        admitted(store, prepared).startCollection()
        prepared.result = PaymentResult("pi_fixture", "succeeded", true)
        assertEquals(Outcome.PAID, coordinator(store, prepared, now + 70_000).recoverKnownAttempt())
        assertEquals(1, prepared.paymentIds.size)
        assertEquals(listOf("pi_fixture"), prepared.recoveries)
        assertEquals(1, prepared.attempts)
        assertNotNull(store.state.attempt)
    }

    @Test fun unknownOutcomeReplaysOnlyRetainedTicket() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi().apply { failPayment = true }
        admitted(store, prepared).let { assertFails { it.startCollection() } }
        prepared.failPayment = false
        coordinator(store, prepared).startCollection()
        assertEquals(listOf<String?>(null, null), prepared.paymentIds)
        assertEquals(1, prepared.attempts)
    }

    @Test fun expiredUnknownCannotCollectOrReplace() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi().apply { failPayment = true }
        admitted(store, prepared).let { assertFails { it.startCollection() } }
        val restarted = coordinator(store, prepared, now + 70_000)
        assertFails { restarted.startCollection() }
        assertFails { restarted.startPrepared(reference) }
        assertEquals(1, prepared.attempts)
        assertEquals(1, prepared.paymentIds.size)
    }

    @Test fun corruptionAndInitialWriteFailureBlockNetwork() {
        val store = MemoryStore(DurableState(session)).apply { fail = true }
        val prepared = PreparedApi()
        assertFails { coordinator(store, prepared).startPrepared(reference) }
        assertEquals(0, prepared.attempts)
    }

    @Test fun failedIdWritePoisonsInstanceAndRetainsReplayTicket() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi().apply { onPayment = { store.fail = true } }
        val c = admitted(store, prepared)
        assertFails { c.startCollection() }
        store.fail = false
        assertFails { c.recoverKnownAttempt() }
        assertNull(store.state.attempt?.paymentIntentId)
        assertEquals(ticket, store.state.attempt?.ticket)
    }

    @Test fun loginReplacesExpiredSessionOnlyWithoutAttempt() {
        val expired = session.copy(expiresAt = now)
        val replacement = session.copy(association = "replacement")
        val store = MemoryStore(DurableState(expired))
        assertEquals(replacement, coordinator(store).login { replacement })
        assertEquals(DurableState(replacement), store.state)

        store.state = DurableState(session)
        admitted(store, PreparedApi())
        store.state = store.state.copy(session = expired)
        var logins = 0
        assertFails { coordinator(store).login { logins++; replacement } }
        assertEquals(0, logins)
        assertNotNull(store.state.attempt)
    }

    @Test fun missingOriginalSessionBlocksRecoveryAndLoginBeforeCallback() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        admitted(store, prepared).startCollection()
        store.state = store.state.copy(session = null)
        assertFails { coordinator(store, prepared).recoverKnownAttempt() }
        var logins = 0
        assertFails { coordinator(store, prepared).login { logins++; session } }
        assertEquals(0, logins)
        assertNotNull(store.state.attempt)
        assertTrue(prepared.recoveries.isEmpty())
    }

    @Test fun changedOriginOrSessionBlocksRecovery() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        admitted(store, prepared).startCollection()
        val retained = store.state
        store.state = retained.copy(session = session.copy(association = "replacement"))
        assertFails { coordinator(store, prepared).recoverKnownAttempt() }
        store.state = retained.copy(session = session.copy(origin = "https://other.invalid"))
        assertFails { coordinator(store, prepared).recoverKnownAttempt() }
        assertTrue(prepared.recoveries.isEmpty())
    }

    @Test fun knownIdMismatchFailsWithoutResolving() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        val c = admitted(store, prepared)
        c.startCollection()
        prepared.result = PaymentResult("pi_other", "succeeded", true)
        assertFails { c.recoverKnownAttempt() }
        assertFalse(store.state.attempt!!.resolved)
    }

    @Test fun simultaneousCollectionStartsPrepareOnlyOnce() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val c = admitted(store, prepared)
        prepared.onPayment = { entered.countDown(); assertTrue(release.await(5, TimeUnit.SECONDS)) }
        val pool = Executors.newSingleThreadExecutor()
        try {
            val first = pool.submit<TransientCollectionStart> { c.startCollection() }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            assertTrue(runCatching { c.startCollection() }.isFailure)
            release.countDown()
            assertEquals("pi_fixture", first.get(5, TimeUnit.SECONDS).attempt.paymentIntentId)
            assertEquals(1, prepared.attempts)
            assertEquals(1, prepared.paymentIds.size)
        } finally { release.countDown(); pool.shutdownNow() }
    }

    @Test fun preparedMarkerIsDurableBeforeOneTimeIssueAndNeverRetainsReference() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        listOf("", "A".repeat(42), "!" + "A".repeat(42), "B".repeat(43)).forEach {
            assertFails { coordinator(store, prepared).startPrepared(it) }
        }
        assertNull(store.state.attempt)
        assertEquals(0, prepared.attempts)
        prepared.onAttempt = {
            assertEquals(AttemptMode.PREPARED, store.state.attempt?.mode)
            assertEquals(session.association, store.state.attempt?.sessionAssociation)
            assertEquals(session.origin, store.state.attempt?.origin)
            assertNull(store.state.attempt?.ticket)
            assertFalse(store.state.toString().contains(reference))
        }

        assertEquals(Outcome.PENDING, coordinator(store, prepared).startPrepared(reference))

        assertEquals(1, prepared.attempts)
        assertEquals(ticket, store.state.attempt?.ticket)
        assertFalse(store.state.toString().contains(reference))
    }

    @Test fun lostPreparedIssueResponseBlocksEveryRetryWithoutReissuing() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi().apply { failAttempt = true }
        assertFails { coordinator(store, prepared).startPrepared(reference) }

        val restarted = coordinator(store, prepared)
        assertFails { restarted.startPrepared(reference) }
        assertFails { restarted.startCollection() }
        assertEquals(1, prepared.attempts)
        assertNull(store.state.attempt?.ticket)
        assertEquals(AttemptMode.PREPARED, store.state.attempt?.mode)
    }

    @Test fun preparedPaymentAndRecoveryRetainSameId() {
        val store = MemoryStore(DurableState(session))
        val prepared = PreparedApi()
        val c = admitted(store, prepared)

        c.startCollection()
        assertEquals(listOf<String?>(null), prepared.paymentIds)
        assertEquals("pi_fixture", store.state.attempt?.paymentIntentId)
        c.startCollection()
        assertEquals(listOf<String?>(null, "pi_fixture"), prepared.paymentIds)

        c.recoverKnownAttempt()
        assertEquals(listOf("pi_fixture"), prepared.recoveries)
        prepared.result = PaymentResult("pi_other", "requires_payment_method", false, "secret_fixture")
        assertFails { c.recoverKnownAttempt() }
        assertEquals(listOf("pi_fixture", "pi_fixture"), prepared.recoveries)
    }

    @Test fun retainedLegacyAttemptFailsClosedAndIsNeverCollectedOrCleared() {
        val legacyStates = listOf(
            AttemptState(ticket, session.association, session.origin, mode = AttemptMode.LEGACY),
            AttemptState(ticket, session.association, session.origin, "pi_legacy", mode = AttemptMode.LEGACY),
            AttemptState(ticket, session.association, session.origin, "pi_legacy", resolved = true, mode = AttemptMode.LEGACY),
        )
        legacyStates.forEach { legacy ->
            val retained = DurableState(session, legacy)
            val store = MemoryStore(retained)
            val prepared = PreparedApi().apply { result = PaymentResult("pi_legacy", "succeeded", true) }
            val c = coordinator(store, prepared)

            assertFails { c.startCollection() }
            assertFails { c.recoverKnownAttempt() }
            assertFails { c.recoverKnownPreparedAttemptForStartup() }
            assertFails { c.cancelUnpaidPreparedAttempt() }
            assertFails { c.resolveTicketOnlyPreparedAttempt() }
            assertFails { c.clearResolvedPreparedAttempt() }
            assertFails { c.retainedPreparedAttemptForNativeRuntime() }
            assertFails { c.startPrepared(reference) }
            assertFails { c.login { session } }

            assertEquals(retained, store.state)
            assertEquals(0, prepared.attempts)
            assertTrue(prepared.paymentIds.isEmpty())
            assertTrue(prepared.recoveries.isEmpty())
            assertEquals(0, prepared.cancels)
            assertEquals(0, prepared.creationStatusRequests)
        }
    }

    @Test fun approvedOriginRejectsMissingInsecureOrAmbiguousConfiguration() {
        listOf("", "http://approved.invalid", "https://x.invalid/path", "https://u:p@x.invalid",
            "https://x.invalid?query", "https://x.invalid#fragment", "https://x.invalid:444").forEach {
            assertFails { ApprovedOrigin(it) }
        }
    }

    @Test fun connectedReaderMustMatchEveryTicketAndPhysicalBinding() {
        val reader = ConnectedReader("tmr_liveFixture", "STRM2D533025669", "stripe_m2", Approved.LOCATION)
        assertTrue(ReaderPolicy.matches(reader, ticket, "tmr_liveFixture"))
        listOf(reader.copy(id = ""), reader.copy(id = "tmr_other"), reader.copy(serial = "wrong"),
            reader.copy(type = "chipper"), reader.copy(location = "tml_other")).forEach {
            assertFalse(ReaderPolicy.matches(it, ticket, "tmr_liveFixture"))
        }
        assertFalse(ReaderPolicy.matches(reader, ticket, null))
    }

    private fun config() = JSONObject().put("accountId", Approved.ACCOUNT)
        .put("productId", Approved.PRODUCT).put("priceId", Approved.PRICE)
        .put("locationId", Approved.LOCATION).put("amount", 100).put("currency", "usd")
        .put("paymentCreationEnabled", true).put("livemode", true)

    @Test fun parserRejectsCatalogAndModeOverridesAndInconsistentPaid() {
        Contract.preflight(config())
        listOf("accountId", "productId", "priceId", "locationId", "currency", "amount").forEach {
            assertFails { Contract.preflight(config().put(it, "wrong")) }
        }
        assertFails { Contract.preflight(config().put("livemode", false)) }
        assertFails { Contract.preflight(config().apply { remove("livemode") }) }
        assertFails { Contract.preflight(config().put("paymentCreationEnabled", false)) }
        assertFails { Contract.preflight(config().put("paymentCreationEnabled", "true")) }
        assertFails { Contract.payment(JSONObject("""{"id":"pi_fixture","status":"processing","paid":true}"""), false) }
        assertFails { Contract.payment(JSONObject("""{"id":"pi_fixture","status":"succeeded","paid":false}"""), false) }
        assertFails { Contract.payment(JSONObject("""{"id":"pi_fixture","status":"succeeded","paid":true,"clientSecret":"secret"}"""), true) }
    }
}
