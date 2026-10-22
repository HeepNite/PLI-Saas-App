package com.pli.kiosk.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.net.URL

@RunWith(AndroidJUnit4::class)
class StaffSessionTransportCompatibilityTest {
    @Test
    fun preparedTicketExpiryParsesOnTheDeviceRuntime() {
        val origin = ApprovedOrigin("https://approved.invalid")
        val response = HttpResponse(
            200,
            emptyMap(),
            """{"ticket":"prepared-ticket","expiresAt":9007199254740993,"readerId":"tmr_fixture","locationId":"${Approved.LOCATION}"}""".toByteArray(),
        )
        val transport = StaffSessionTransport(origin, FixedResponseClient(response)) { 1_000_000L }
        val session = StaffSession(origin.value, "association", "session-cookie", 1_000_001L)

        val ticket = StaffSessionPurchaseApi(transport).preparedAttempt(session, "opaque-reference")

        assertEquals(9_007_199_254_740_993L, ticket.expiresAt)
    }

    private class FixedResponseClient(private val response: HttpResponse) : StaffSessionHttpClient {
        override fun post(endpoint: URL, body: ByteArray, sessionCookie: String?) = response
    }
}
