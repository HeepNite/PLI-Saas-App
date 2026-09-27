package com.pli.kiosk.android

import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.net.URL
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class StaffSessionTransportTest {
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val now = 1_000_000L

    @Test
    fun loginUsesOnlyTheFixedEndpointAcceptsASafeCookieAndClearsThePin() {
        val client = RecordingStaffSessionHttpClient(
            HttpResponse(
                200,
                mapOf("Set-Cookie" to listOf("pli_terminal_session=session-value; Secure; HttpOnly; Path=/; Max-Age=60")),
                ByteArray(0),
            ),
        )
        val transport = StaffSessionTransport(origin, client) { now }
        val pin = "1234".toCharArray()

        val session = transport.login("front-desk", pin)

        assertEquals("https://approved.invalid/api/staff/terminal/login", client.endpoint.toString())
        assertNull(client.cookie)
        assertEquals("front-desk", JSONObject(client.body.decodeToString()).getString("slug"))
        assertEquals("session-value", session.cookie)
        assertEquals(now + 60_000L, session.expiresAt)
        assertTrue(pin.all { it == '\u0000' })
    }

    @Test
    fun rejectedLoginStillClearsThePinBuffer() {
        val transport = StaffSessionTransport(
            origin,
            RecordingStaffSessionHttpClient(HttpResponse(401, emptyMap(), ByteArray(0))),
            { now },
        )
        val pin = "1234".toCharArray()

        assertFailsWith<IllegalArgumentException> { transport.login("front-desk", pin) }
        assertTrue(pin.all { it == '\u0000' })
    }

    @Test
    fun purchaseApiSendsOnlyPhoneForLookupAndMapsExplicitLookupOutcomes() {
        val session = StaffSession(origin.value, "association", "session-value", now + 1)
        val successClient = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"student":{"id":"student_fixture","name":"Fixture student"}}""".toByteArray()),
        )
        val successApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, successClient) { now })

        assertEquals(
            StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student")),
            successApi.lookup(session, "+15550000000"),
        )
        val request = JSONObject(successClient.body.decodeToString())
        assertEquals(setOf("action", "phone"), request.keys().asSequence().toSet())
        assertEquals("student-lookup", request.getString("action"))
        assertEquals("+15550000000", request.getString("phone"))
        assertEquals("session-value", successClient.cookie)

        mapOf(400 to StudentLookupResult.Invalid, 404 to StudentLookupResult.Missing, 409 to StudentLookupResult.Ambiguous).forEach {
            (status, expected) ->
            val api = StaffSessionPurchaseApi(StaffSessionTransport(origin, RecordingStaffSessionHttpClient(
                HttpResponse(status, emptyMap(), """{"error":"fixture"}""".toByteArray()),
            )) { now })
            assertEquals(expected, api.lookup(session, "+15550000000"))
        }
    }

    @Test
    fun attemptSendsTheConfirmedPhoneAndNeverAClientControlledStudentId() {
        val session = StaffSession(origin.value, "association", "session-value", now + 1)
        val client = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"ticket":"signed-recipient-binding-fixture","expiresAt":1060000,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""".toByteArray()),
        )
        val api = StaffSessionPurchaseApi(StaffSessionTransport(origin, client) { now })

        assertEquals(
            AttemptTicket("signed-recipient-binding-fixture", 1_060_000L, "tmr_fixture", Approved.LOCATION),
            api.issue(session, "+15550000000"),
        )
        val request = JSONObject(client.body.decodeToString())
        assertEquals(setOf("action", "phone"), request.keys().asSequence().toSet())
        assertEquals("attempt", request.getString("action"))
        assertEquals("+15550000000", request.getString("phone"))
    }

    @Test
    fun collectionRefreshSendsOnlyTheRetainedTicketAndPaymentIntentId() {
        val client = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_known","status":"requires_payment_method","paid":false,"clientSecret":"secret"}""".toByteArray()),
        )
        val api = StaffSessionPurchaseApi(StaffSessionTransport(origin, client) { now })
        val session = StaffSession(origin.value, "association", "session-value", now + 1)

        assertEquals(
            PaymentResult("pi_known", "requires_payment_method", false, "secret"),
            api.refreshCollection(session, AttemptTicket("ticket", now + 1, "reader", Approved.LOCATION), "pi_known"),
        )
        val request = JSONObject(client.body.decodeToString())
        assertEquals(setOf("action", "ticket", "paymentIntentId"), request.keys().asSequence().toSet())
        assertEquals("payment-intent", request.getString("action"))
        assertEquals("ticket", request.getString("ticket"))
        assertEquals("pi_known", request.getString("paymentIntentId"))
    }

    @Test
    fun loginRejectsAnUnsafeCookieAndPostRejectsAnUnboundSession() {
        val unsafeClient = RecordingStaffSessionHttpClient(
            HttpResponse(200, mapOf("Set-Cookie" to listOf("pli_terminal_session=value; HttpOnly; Path=/; Max-Age=60")), ByteArray(0)),
        )
        val transport = StaffSessionTransport(origin, unsafeClient) { now }

        assertFailsWith<IllegalArgumentException> { transport.login("front-desk", "1234".toCharArray()) }

        val client = RecordingStaffSessionHttpClient(HttpResponse(200, emptyMap(), ByteArray(0)))
        val postingTransport = StaffSessionTransport(origin, client) { now }
        val valid = StaffSession(origin.value, "association", "session-value", now + 1)
        postingTransport.postInternalPurchase(valid, JSONObject().put("action", "prepare"))
        assertEquals("https://approved.invalid/api/kiosk/terminal/internal-purchase", client.endpoint.toString())
        assertEquals("session-value", client.cookie)
        assertFailsWith<IllegalArgumentException> {
            postingTransport.postInternalPurchase(valid.copy(origin = "https://other.invalid"), JSONObject())
        }
        assertFailsWith<IllegalArgumentException> {
            postingTransport.postInternalPurchase(valid.copy(expiresAt = now), JSONObject())
        }
    }

    private class RecordingStaffSessionHttpClient(
        private val response: HttpResponse,
    ) : StaffSessionHttpClient {
        lateinit var endpoint: URL
        lateinit var body: ByteArray
        var cookie: String? = null

        override fun post(endpoint: URL, body: ByteArray, sessionCookie: String?): HttpResponse {
            this.endpoint = endpoint
            this.body = body
            cookie = sessionCookie
            return response
        }
    }
}
