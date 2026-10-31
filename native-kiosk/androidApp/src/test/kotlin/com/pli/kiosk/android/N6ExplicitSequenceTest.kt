package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class N6ExplicitSequenceTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session", "cookie", now + 120_000)

    @Test
    fun beginAttemptPersistsOnlyTheSignedTicketBeforeAnyPaymentIntent() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        val coordinator = PurchaseCoordinator(origin, store, api) { now }

        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
        assertEquals(Outcome.PENDING, coordinator.start())

        assertEquals(1, api.preflights)
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
        val ticketOnly = PurchaseCoordinator(origin, ticketOnlyStore, ticketOnlyApi) { now }
        ticketOnly.lookupStudent("+15550000000")
        ticketOnly.confirmSelectedStudent()
        ticketOnly.start()

        assertEquals(Outcome.PENDING, PurchaseCoordinator(origin, ticketOnlyStore, ticketOnlyApi) { now }.resume())
        assertEquals(1, ticketOnlyApi.issued)
        assertEquals(0, ticketOnlyApi.prepares)

        val knownStore = MemoryStore(DurableState(session, AttemptState(AttemptTicket("ticket", now + 60_000, "tmr_fixture", Approved.LOCATION), session.association, origin.value, "pi_same")))
        val knownApi = Api().apply { refreshed = PaymentResult("pi_same", "processing", false) }
        assertEquals(Outcome.PENDING, PurchaseCoordinator(origin, knownStore, knownApi) { now }.resume())
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

    private class Api : PurchaseApi {
        var lookups = 0
        var preflights = 0
        var issued = 0
        var prepares = 0
        var recoveries = 0
        var prepared = PaymentResult("pi_fixture", "requires_payment_method", false, "secret")
        var refreshed = PaymentResult("pi_fixture", "requires_payment_method", false, "secret_refresh")
        override fun lookup(session: StaffSession, phone: String): StudentLookupResult {
            lookups++
            return StudentLookupResult.Unique(MinimumStudentIdentity("Fixture"))
        }
        override fun preflight(session: StaffSession) { preflights++ }
        override fun issue(session: StaffSession, phone: String): AttemptTicket {
            issued++
            return AttemptTicket("ticket", 1_060_000, "tmr_fixture", Approved.LOCATION)
        }
        override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult {
            prepares++
            return prepared
        }
        override fun refreshCollection(session: StaffSession, ticket: AttemptTicket, id: String) = refreshed
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult {
            recoveries++
            return refreshed
        }
    }
}
