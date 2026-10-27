package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Production 2026-10-27 (Samsung, APK 1.2.0): after a not-charged sale was canceled and cleared,
 * every later sale was refused locally because the browser-captured session is bounded to
 * 15 minutes and nothing renewed it while the terminal page stayed open.
 */
class SaleSessionRenewalTest {
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val terminal = "${origin.value}/staff/terminal"
    private val cookie = "pli_terminal_session=browser-session"

    @Test
    fun withoutRenewalASaleAfterTheCaptureBoundIsRefusedBeforeAnyServerCallWithoutPoisoning() {
        val kiosk = Kiosk()
        assertTrue(kiosk.readiness.capture(terminal, terminal))

        kiosk.clock.advanceBy(MINUTE * 16)

        val coordinator = kiosk.coordinator()
        assertFailsWith<IllegalArgumentException> { coordinator.startPrepared(reference('A')) }
        assertTrue(kiosk.api.references.isEmpty())

        // An expired session is not corrupt state: the same bridge coordinator recovers after renewal.
        assertTrue(kiosk.readiness.renewCapturedSession())
        assertEquals(Outcome.PENDING, coordinator.startPrepared(reference('A')))
    }

    @Test
    fun inSessionCanceledSaleThenReloadThenLateSaleIsAdmittedAfterRenewal() {
        val kiosk = Kiosk()
        assertTrue(kiosk.readiness.capture(terminal, terminal))
        val coordinator = kiosk.coordinator()

        // 16:17 sale, 16:19 collection deadline, server prepared-cancel answers canceled.
        kiosk.clock.advanceBy(MINUTE)
        assertTrue(kiosk.readiness.renewCapturedSession())
        assertEquals(Outcome.PENDING, coordinator.startPrepared(reference('A')))
        coordinator.startCollection()
        assertEquals(PreparedCancelOutcome.CANCELED, coordinator.cancelUnpaidPreparedAttempt())
        assertNull(kiosk.store.state.attempt)

        // 16:21 deploy-watchdog reload of the same page keeps the same session authority.
        kiosk.clock.advanceBy(MINUTE * 4)
        assertTrue(kiosk.readiness.capture(terminal, terminal))
        assertTrue(kiosk.readiness.currentSession() != null)

        // 17:05 next sale, well past the 15-minute capture bound.
        kiosk.clock.advanceBy(MINUTE * 44)
        assertTrue(kiosk.readiness.renewCapturedSession())
        assertTrue(kiosk.readiness.currentSession() != null, "a later watchdog reload must keep the renewed authority")
        assertEquals(Outcome.PENDING, coordinator.startPrepared(reference('B')))
        assertEquals(2, kiosk.api.references.size)
    }

    @Test
    fun aRelaunchedKioskAdmitsASaleLongAfterItsStartupCapture() {
        val clock = MutableClock(1_000_000L)
        val store = MemoryStore()
        val first = Kiosk(clock, store)
        assertTrue(first.readiness.capture(terminal, terminal))

        // 17:07 force-stop and relaunch: a new process captures again; 17:49 sale.
        clock.advanceBy(MINUTE * 60)
        val relaunched = Kiosk(clock, store)
        assertTrue(relaunched.readiness.capture(terminal, terminal))
        clock.advanceBy(MINUTE * 42)

        assertTrue(relaunched.readiness.renewCapturedSession())
        assertEquals(Outcome.PENDING, relaunched.coordinator().startPrepared(reference('C')))
    }

    @Test
    fun renewalNeverAdoptsADifferentMissingOrUncapturedSessionOrReplacesARetainedAttempt() {
        val uncaptured = Kiosk()
        assertFalse(uncaptured.readiness.renewCapturedSession())
        assertEquals(0, uncaptured.store.writes)

        var browserCookie: String? = cookie
        val kiosk = Kiosk(readCookie = { browserCookie })
        assertTrue(kiosk.readiness.capture(terminal, terminal))
        val captured = kiosk.store.state
        kiosk.clock.advanceBy(MINUTE * 16)

        browserCookie = "pli_terminal_session=another-staff-session"
        assertFalse(kiosk.readiness.renewCapturedSession())
        browserCookie = null
        assertFalse(kiosk.readiness.renewCapturedSession())
        assertEquals(captured, kiosk.store.state)

        browserCookie = cookie
        val session = requireNotNull(captured.session)
        val retained = DurableState(
            session,
            AttemptState(
                AttemptTicket("ticket", kiosk.clock.now + MINUTE, "tmr_exact", Approved.LOCATION),
                session.association, session.origin, "pi_retained", mode = AttemptMode.PREPARED,
            ),
        )
        kiosk.store.state = retained
        assertFalse(kiosk.readiness.renewCapturedSession())
        assertEquals(retained, kiosk.store.state)
    }

    private inner class Kiosk(
        val clock: MutableClock = MutableClock(1_000_000L),
        val store: MemoryStore = MemoryStore(),
        readCookie: () -> String? = { cookie },
    ) {
        val api = PreparedApi(clock)
        val readiness = WebSessionReadiness(
            origin, store, StaffSessionTransport(origin) { clock.now }, BrowserCookieReader { readCookie() },
            { clock.now }, api,
        )
        fun coordinator() = PurchaseCoordinator(origin, store, LegacyApi(), { clock.now }, api)
    }

    private fun reference(first: Char) = first + "A".repeat(42)

    private class PreparedApi(private val clock: MutableClock) : PreparedPurchaseApi {
        val references = mutableListOf<String>()
        override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String): AttemptTicket {
            references += preparedPurchaseReference
            return AttemptTicket("ticket-${references.size}", clock.now + MINUTE * 10, "tmr_exact", Approved.LOCATION)
        }
        override fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String?) =
            PaymentResult("pi_${references.size}", "requires_payment_method", false, "secret")
        override fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
            PaymentResult(paymentIntentId, "requires_payment_method", false)
        override fun preparedCancel(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
            PaymentResult(paymentIntentId, "canceled", false)
    }

    private class LegacyApi : PurchaseApi {
        override fun lookup(session: StaffSession, phone: String) = StudentLookupResult.Invalid
        override fun preflight(session: StaffSession) = Unit
        override fun issue(session: StaffSession, phone: String) = error("legacy issue")
        override fun prepare(session: StaffSession, ticket: AttemptTicket) = error("legacy prepare")
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String) = error("legacy recover")
    }

    class MutableClock(var now: Long) {
        fun advanceBy(millis: Long) { now += millis }
    }

    class MemoryStore(var state: DurableState = DurableState()) : StateStore {
        var writes = 0
        override fun read() = state
        override fun write(state: DurableState) { writes++; this.state = state }
    }

    private companion object {
        const val MINUTE = 60_000L
    }
}
