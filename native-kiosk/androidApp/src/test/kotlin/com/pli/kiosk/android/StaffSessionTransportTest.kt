package com.pli.kiosk.android

import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
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

        assertEquals("https://approved.invalid/api/staff/terminal/session", client.endpoint.toString())
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
            HttpResponse(200, emptyMap(), """{"student":{"name":"Fixture student"}}""".toByteArray()),
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

    @Test
    fun browserCookieImportBindsTheApprovedOriginAndUsesTheConservativeCaptureTtl() {
        var clock = now
        val client = RecordingStaffSessionHttpClient(HttpResponse(200, emptyMap(), ByteArray(0)))
        val transport = StaffSessionTransport(origin, client) { clock }

        val session = transport.importBrowserSession("other=value; pli_terminal_session=browser-session-value")

        assertEquals(origin.value, session.origin)
        assertEquals("browser-session-value", session.cookie)
        assertEquals("93cea2edf00e2e8786b4504005d20f54714ad60b3021845f40a878be675afc70", session.association)
        assertEquals(now + 15 * 60 * 1_000L, session.expiresAt)
        clock = session.expiresAt
        assertFailsWith<IllegalArgumentException> { transport.postInternalPurchase(session, JSONObject().put("action", "prepared-attempt")) }
        assertFailsWith<ArithmeticException> {
            StaffSessionTransport(origin, client) { Long.MAX_VALUE }.importBrowserSession("pli_terminal_session=value")
        }
    }

    @Test
    fun browserCookieImportRejectsMissingDuplicateMalformedQuotedAndVariantCookies() {
        val transport = StaffSessionTransport(origin, RecordingStaffSessionHttpClient(HttpResponse(200, emptyMap(), ByteArray(0)))) { now }

        listOf(
            "",
            "other=value",
            "pli_terminal_session=one; pli_terminal_session=two",
            "PLI_TERMINAL_SESSION=value",
            "pli_terminal_session =value",
            "pli_terminal_session=\"value\"",
            "pli_terminal_session=value\n",
            "pli_terminal_session=",
        ).forEach { header ->
            assertFailsWith<IllegalArgumentException> { transport.importBrowserSession(header) }
        }
    }

    @Test
    fun preparedAttemptUsesOnlyTheOpaqueReferenceAndKeepsCookieInNativeTransport() {
        val client = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"ticket":"prepared-ticket","expiresAt":9007199254740993,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""".toByteArray()),
        )
        val api: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, client) { now })
        val session = StaffSession(origin.value, "association", "session-value", now + 1)

        assertEquals(AttemptTicket("prepared-ticket", 9_007_199_254_740_993L, "tmr_fixture", Approved.LOCATION), api.preparedAttempt(session, "opaque-reference"))
        val request = JSONObject(client.body.decodeToString())
        assertEquals(setOf("action", "preparedPurchaseReference"), request.keys().asSequence().toSet())
        assertEquals("prepared-attempt", request.getString("action"))
        assertEquals("opaque-reference", request.getString("preparedPurchaseReference"))
        assertEquals("session-value", client.cookie)
    }

    @Test
    fun preparedAttemptRequiresOneExactBaseTenIntegerExpiryLexeme() {
        val session = StaffSession(origin.value, "association", "session-value", now + 1)
        listOf("+1", "01", "0x10", "1.", "1.0", "1e3", "NaN", "Infinity", "-Infinity", "\"1\"", "null", "true", "false", "9223372036854775808", "-9223372036854775809").forEach { expiresAt ->
            assertFailsWith<IOException> { preparedApi("""{"ticket":"prepared-ticket","expiresAt":$expiresAt,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference") }
        }
        listOf(
            """{"ticket":"prepared-ticket","expiresAt":1,"expiresAt":2,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""",
            """{"ticket":"prepared-ticket","expiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt","nested":{"expiresAt":2}}""",
            """{"ticket":"prepared-ticket","\u+065xpiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""",
            """{"ticket":"prepared-ticket","\u00G5xpiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""",
        ).forEach { body -> assertFailsWith<IOException> { preparedApi(body).preparedAttempt(session, "opaque-reference") } }
        assertEquals(1L, preparedApi("""{"ticket":"prepared \\\"expiresAt\\\":2","expiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference").expiresAt)
        assertEquals(Long.MAX_VALUE, preparedApi("""{"ticket":"prepared-ticket","expiresAt":9223372036854775807,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference").expiresAt)
        assertFailsWith<IllegalArgumentException> { preparedApi("""{"ticket":"prepared-ticket","expiresAt":-9223372036854775808,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference") }
        assertFailsWith<IOException> { preparedApi("""{"ticket":"\uD800","expiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference") }
        listOf("""\u0001""", """\n""").forEach { escapedControl ->
            assertFailsWith<IOException> { preparedApi("""{"ticket":"prepared$escapedControl ticket","expiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference") }
        }
        assertFailsWith<IOException> { preparedApi("""{ticket:"prepared-ticket","expiresAt":1,"readerId":"tmr_fixture","locationId":"tml_GqQ6wPY5rSAhAt"}""").preparedAttempt(session, "opaque-reference") }
        assertFailsWith<IOException> { preparedApi("{\"ticket\":\"prepared${'\u0001'}ticket\",\"expiresAt\":1,\"readerId\":\"tmr_fixture\",\"locationId\":\"tml_GqQ6wPY5rSAhAt\"}").preparedAttempt(session, "opaque-reference") }
        assertFailsWith<IOException> { preparedApi(byteArrayOf('{'.code.toByte(), 0x80.toByte(), '}'.code.toByte())).preparedAttempt(session, "opaque-reference") }
    }

    @Test
    fun preparedPaymentUsesOnlyTicketAndOptionalKnownIdAndRejectsMalformedResponses() {
        val ticket = AttemptTicket("prepared-ticket", now + 1, "tmr_fixture", Approved.LOCATION)
        val freshClient = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_fresh","status":"requires_payment_method","paid":false,"clientSecret":"secret"}""".toByteArray()),
        )
        val freshApi: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, freshClient) { now })
        val session = StaffSession(origin.value, "association", "session-value", now + 1)

        assertEquals(PaymentResult("pi_fresh", "requires_payment_method", false, "secret"), freshApi.preparedPaymentIntent(session, ticket))
        val freshRequest = JSONObject(freshClient.body.decodeToString())
        assertEquals(setOf("action", "ticket"), freshRequest.keys().asSequence().toSet())
        assertEquals("prepared-payment-intent", freshRequest.getString("action"))

        val knownClient = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_known","status":"requires_payment_method","paid":false}""".toByteArray()),
        )
        val knownApi: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, knownClient) { now })
        assertEquals(PaymentResult("pi_known", "requires_payment_method", false), knownApi.preparedPaymentIntent(session, ticket, "pi_known"))
        val knownRequest = JSONObject(knownClient.body.decodeToString())
        assertEquals(setOf("action", "ticket", "paymentIntentId"), knownRequest.keys().asSequence().toSet())
        assertEquals("prepared-payment-intent", knownRequest.getString("action"))

        val malformedApi: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_bad","status":"succeeded","paid":false}""".toByteArray()),
        )) { now })
        assertFailsWith<IllegalArgumentException> { malformedApi.preparedPaymentIntent(session, ticket) }
        listOf(
            """{"id":"pi_first","id":"pi_second","status":"requires_payment_method","paid":false}""",
            """{"id":"pi_known","status":"requires_payment_method","paid":false} trailing""",
            """{"id":{"value":"pi_known"},"status":"requires_payment_method","paid":false}""",
            """{"id":"pi_known","status":"requires_payment_method","paid":"false"}""",
        ).forEach { body ->
            assertFailsWith<IOException> { preparedApi(body).preparedPaymentIntent(session, ticket) }
        }
    }

    @Test
    fun preparedCreationStatusUsesOnlyTheRetainedTicketAndAcceptsOnlyItsClosedEnum() {
        val session = StaffSession(origin.value, "association", "session-value", now + 1)
        val ticket = AttemptTicket("prepared-ticket", now + 1, "tmr_fixture", Approved.LOCATION)
        val client = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"creation":"UNCREATED"}""".toByteArray()),
        )
        val api: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, client) { now })

        assertEquals(PreparedCreationStatus.UNCREATED, api.preparedCreationStatus(session, ticket))
        val request = JSONObject(client.body.decodeToString())
        assertEquals(setOf("action", "ticket"), request.keys().asSequence().toSet())
        assertEquals("prepared-creation-status", request.getString("action"))
        assertEquals(ticket.value, request.getString("ticket"))
        assertEquals("session-value", client.cookie)
        val createdApi: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(
            origin,
            RecordingStaffSessionHttpClient(HttpResponse(200, emptyMap(), """{"creation":"CREATED"}""".toByteArray())),
        ) { now })
        assertEquals(PreparedCreationStatus.CREATED, createdApi.preparedCreationStatus(session, ticket))

        listOf(
            """{"creation":"created"}""",
            """{"creation":"UNCREATED","extra":true}""",
            """{"creation":"UNCREATED","creation":"CREATED"}""",
            """{"creation":true}""",
            """{"creation":{"value":"UNCREATED"}}""",
            """{"creation":"UNCREATED"} trailing""",
        ).forEach { body ->
            val statusApi: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(
                origin,
                RecordingStaffSessionHttpClient(HttpResponse(200, emptyMap(), body.toByteArray())),
            ) { now })
            assertFailsWith<IOException> { statusApi.preparedCreationStatus(session, ticket) }
        }
    }

    @Test
    fun preparedRecoveryRequiresKnownIdAndRejectsClientSecrets() {
        val ticket = AttemptTicket("prepared-ticket", now + 1, "tmr_fixture", Approved.LOCATION)
        val secretClient = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_known","status":"requires_payment_method","paid":false,"clientSecret":"secret"}""".toByteArray()),
        )
        val api: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, secretClient) { now })
        val session = StaffSession(origin.value, "association", "session-value", now + 1)

        assertFailsWith<IllegalArgumentException> { api.preparedRecover(session, ticket, "pi_known") }
        val request = JSONObject(secretClient.body.decodeToString())
        assertEquals(setOf("action", "ticket", "paymentIntentId"), request.keys().asSequence().toSet())
        assertEquals("prepared-recover", request.getString("action"))

        val redactedApi: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_known","status":"requires_payment_method","paid":false}""".toByteArray()),
        )) { now })
        assertEquals(PaymentResult("pi_known", "requires_payment_method", false), redactedApi.preparedRecover(session, ticket, "pi_known"))
        assertFailsWith<IllegalArgumentException> { api.preparedRecover(session, ticket, "") }
    }

    @Test
    fun preparedCancelSendsOnlyTicketAndExactKnownIdAndRejectsClientSecrets() {
        val ticket = AttemptTicket("prepared-ticket", now + 1, "tmr_fixture", Approved.LOCATION)
        val session = StaffSession(origin.value, "association", "session-value", now + 1)
        val client = RecordingStaffSessionHttpClient(
            HttpResponse(200, emptyMap(), """{"id":"pi_known","status":"canceled","paid":false}""".toByteArray()),
        )
        val api: PreparedPurchaseApi = StaffSessionPurchaseApi(StaffSessionTransport(origin, client) { now })

        assertEquals(PaymentResult("pi_known", "canceled", false), api.preparedCancel(session, ticket, "pi_known"))
        val request = JSONObject(client.body.decodeToString())
        assertEquals(setOf("action", "ticket", "paymentIntentId"), request.keys().asSequence().toSet())
        assertEquals("prepared-cancel", request.getString("action"))
        assertEquals("pi_known", request.getString("paymentIntentId"))
        assertEquals("session-value", client.cookie)

        assertFailsWith<IllegalArgumentException> {
            preparedApi("""{"id":"pi_known","status":"canceled","paid":false,"clientSecret":"secret"}""").preparedCancel(session, ticket, "pi_known")
        }
        assertFailsWith<IllegalArgumentException> { preparedApi("""{"id":"pi_known","status":"succeeded","paid":false}""").preparedCancel(session, ticket, "pi_known") }
        assertFailsWith<IllegalArgumentException> { api.preparedCancel(session, ticket, "") }
    }

    private fun preparedApi(body: String): PreparedPurchaseApi = preparedApi(body.toByteArray())

    private fun preparedApi(body: ByteArray): PreparedPurchaseApi = StaffSessionPurchaseApi(
        StaffSessionTransport(origin, RecordingStaffSessionHttpClient(HttpResponse(200, emptyMap(), body))) { now },
    )

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
