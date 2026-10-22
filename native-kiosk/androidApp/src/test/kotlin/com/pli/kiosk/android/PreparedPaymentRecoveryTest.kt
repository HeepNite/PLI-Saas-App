package com.pli.kiosk.android

import kotlin.test.assertEquals
import org.junit.Test

class PreparedPaymentRecoveryTest {
    @Test
    fun `prepared runtime recovery uses the prepared recover action`() {
        val calls = mutableListOf<String>()
        val api = object : PreparedPurchaseApi {
            override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String) =
                throw AssertionError("unexpected attempt")
            override fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String?) =
                throw AssertionError("unexpected payment intent")
            override fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult {
                calls += "prepared-recover:$paymentIntentId"
                return PaymentResult(paymentIntentId, "succeeded", true)
            }
        }
        val session = StaffSession("https://approved.invalid", "association", "cookie", 2_000L)
        val ticket = AttemptTicket("ticket", 2_000L, "tmr_exact", Approved.LOCATION)

        val recovered = PreparedPurchasePaymentRecovery(api).recover(session, ticket, "pi_exact")

        assertEquals(listOf("prepared-recover:pi_exact"), calls)
        assertEquals(RecoveryState.FromServer(PaymentResult("pi_exact", "succeeded", true)), recovered)
    }
}
