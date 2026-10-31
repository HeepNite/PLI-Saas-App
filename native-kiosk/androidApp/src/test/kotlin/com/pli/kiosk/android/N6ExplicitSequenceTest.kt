package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFalse

class N6ExplicitSequenceTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session", "cookie", now + 120_000)
    private val reference = "A".repeat(43)

    @Test
    fun beginAttemptPersistsOnlyTheSignedTicketBeforeAnyPaymentIntent() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        val coordinator = PurchaseCoordinator(origin, store, api) { now }

        assertEquals(Outcome.PENDING, coordinator.startPrepared(reference))

        assertEquals(1, api.issued)
        assertEquals(0, api.prepares)
        assertEquals("ticket", store.state.attempt?.ticket?.value)
        assertEquals(null, store.state.attempt?.paymentIntentId)
        assertFalse(store.writes.any { it.attempt?.paymentIntentId != null })
    }

    @Test
    fun restartAtTicketOnlyAndKnownIdNeverIssuesAnotherTicketOrIntent() {
        val ticketOnlyStore = MemoryStore(DurableState(session))
        val ticketOnlyApi = Api()
        PurchaseCoordinator(origin, ticketOnlyStore, ticketOnlyApi) { now }.startPrepared(reference)

        assertFails { PurchaseCoordinator(origin, ticketOnlyStore, ticketOnlyApi) { now }.startPrepared(reference) }
        assertEquals(1, ticketOnlyApi.issued)
        assertEquals(0, ticketOnlyApi.prepares)

        val knownStore = MemoryStore(DurableState(session, AttemptState(
            AttemptTicket("ticket", now + 60_000, "tmr_fixture", Approved.LOCATION),
            session.association, origin.value, "pi_same", mode = AttemptMode.PREPARED,
        )))
        val knownApi = Api().apply { refreshed = PaymentResult("pi_same", "processing", false) }
        assertEquals(Outcome.PENDING, PurchaseCoordinator(origin, knownStore, knownApi) { now }.recoverKnownAttempt())
        assertEquals(0, knownApi.issued)
        assertEquals(0, knownApi.prepares)
        assertEquals(1, knownApi.recoveries)
    }

    private class MemoryStore(var state: DurableState) : StateStore {
        val writes = mutableListOf<DurableState>()
        override fun read(): DurableState = state
        override fun write(state: DurableState) {
            writes += state
            this.state = state
        }
    }

    private class Api : PreparedPurchaseApi {
        var issued = 0
        var prepares = 0
        var recoveries = 0
        var refreshed = PaymentResult("pi_fixture", "requires_payment_method", false, "secret_refresh")
        override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String): AttemptTicket {
            issued++
            return AttemptTicket("ticket", 1_060_000, "tmr_fixture", Approved.LOCATION)
        }
        override fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String?): PaymentResult {
            prepares++
            return refreshed
        }
        override fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult {
            recoveries++
            return refreshed
        }
    }
}
