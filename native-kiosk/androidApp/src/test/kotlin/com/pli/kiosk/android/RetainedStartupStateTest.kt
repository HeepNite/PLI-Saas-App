package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals

class RetainedStartupStateTest {
    private val origin = "https://approved.invalid"
    private val session = StaffSession(origin, "association", "cookie", 1L)
    private val ticket = AttemptTicket("ticket", 1L, "tmr_exact", Approved.LOCATION)

    @Test
    fun classifiesEveryClosedRetainedStateWithoutIdentifiers() {
        val cases = listOf(
            DurableState() to RetainedStartupState.EMPTY,
            prepared(ticket = null, paymentId = null) to RetainedStartupState.TICKETLESS_PRE_ISSUANCE,
            prepared(ticket = ticket, paymentId = null) to RetainedStartupState.TICKET_ONLY_UNKNOWN_CREATION,
            prepared(ticket = ticket, paymentId = "pi_known") to RetainedStartupState.KNOWN_PAYMENT,
            prepared(ticket = ticket, paymentId = "pi_known", resolved = true) to RetainedStartupState.RESOLVED,
            prepared(ticket = ticket, paymentId = "pi_known").copy(
                attempt = prepared(ticket = ticket, paymentId = "pi_known").attempt?.copy(sessionAssociation = "changed"),
            ) to RetainedStartupState.SESSION_MISMATCH,
            prepared(ticket = ticket.copy(locationId = "wrong"), paymentId = "pi_known") to RetainedStartupState.MALFORMED,
        )

        cases.forEach { (state, expected) ->
            assertEquals(expected, classifyRetainedStartupState(state, origin, session.association))
        }
    }

    @Test
    fun changedOrMissingCurrentBrowserAssociationIsASessionMismatch() {
        val state = prepared(ticket = ticket, paymentId = "pi_known")

        assertEquals(RetainedStartupState.SESSION_MISMATCH, classifyRetainedStartupState(state, origin, "changed"))
        assertEquals(RetainedStartupState.SESSION_MISMATCH, classifyRetainedStartupState(state, origin, null))
    }

    private fun prepared(
        ticket: AttemptTicket?,
        paymentId: String?,
        resolved: Boolean = false,
    ) = DurableState(
        session,
        AttemptState(ticket, session.association, session.origin, paymentId, resolved, AttemptMode.PREPARED),
    )
}
