package com.pli.kiosk.android

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URL
import java.security.MessageDigest
import javax.net.ssl.HttpsURLConnection

/** The only HTTP surface allowed to carry the staff-session cookie in native unit 1. */
class StaffSessionTransport private constructor(
    private val origin: ApprovedOrigin,
    private val clock: () -> Long,
    private val post: (URL, ByteArray, String?) -> HttpResponse,
) {
    constructor(origin: ApprovedOrigin, clock: () -> Long) : this(origin, clock, StrictHttpsClient()::post)

    internal constructor(
        origin: ApprovedOrigin,
        client: StaffSessionHttpClient,
        clock: () -> Long,
    ) : this(origin, clock, client::post)
    fun login(slug: String, pin: CharArray): StaffSession {
        require(slug.isNotBlank() && pin.isNotEmpty()) { "Staff login credentials are required" }
        val response = try {
            post(endpoint(LOGIN_PATH), JSONObject().put("slug", slug).put("pin", String(pin)).toString().toByteArray(), null)
        } finally {
            pin.fill('\u0000')
        }
        require(response.status in 200..299) { "Staff login was rejected" }
        val cookie = parseSessionCookie(response.headers)
        return StaffSession(
            origin = origin.value,
            association = sha256(cookie.value),
            cookie = cookie.value,
            expiresAt = safeExpiry(cookie.maxAge),
        )
    }

    /** No arbitrary endpoint, redirect, browser cookie jar, or caller-provided origin is accepted. */
    fun postInternalPurchase(session: StaffSession, action: JSONObject): HttpResponse {
        require(session.origin == origin.value && session.expiresAt > clock()) { "Original staff session is unavailable" }
        return post(endpoint(INTERNAL_PURCHASE_PATH), action.toString().toByteArray(), session.cookie)
    }

    private fun endpoint(path: String): URL = URL(origin.value + path)

    private fun safeExpiry(maxAge: Long): Long {
        require(maxAge > 0 && maxAge <= MAX_SESSION_SECONDS) { "Invalid staff-session expiry" }
        return Math.addExact(clock(), Math.multiplyExact(maxAge, 1_000L))
    }

    private fun parseSessionCookie(headers: Map<String, List<String>>): ParsedCookie {
        val candidates = headers.entries
            .filter { (name, _) -> name.equals("Set-Cookie", ignoreCase = true) }
            .flatMap { it.value }
            .mapNotNull(::parseCookie)
        require(candidates.size == 1) { "Expected exactly one original staff-session cookie" }
        return candidates.single()
    }

    private fun parseCookie(header: String): ParsedCookie? {
        val parts = header.split(';').map(String::trim)
        val pair = parts.firstOrNull()?.split('=', limit = 2) ?: return null
        if (pair.size != 2 || pair[0] != SESSION_COOKIE) return null
        val attributes = parts.drop(1)
        val names = attributes.map { it.substringBefore('=').trim().lowercase() }.toSet()
        require("secure" in names && "httponly" in names && "domain" !in names) { "Staff cookie attributes are unsafe" }
        require(attributes.any { it.equals("Path=/", ignoreCase = true) }) { "Staff cookie path is unsafe" }
        val maxAge = attributes.firstOrNull { it.substringBefore('=').equals("Max-Age", ignoreCase = true) }
            ?.substringAfter('=', missingDelimiterValue = "")
            ?.toLongOrNull()
            ?: throw IllegalArgumentException("Staff cookie has no Max-Age")
        require(pair[1].isNotBlank()) { "Staff cookie is empty" }
        return ParsedCookie(pair[1], maxAge)
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    private data class ParsedCookie(val value: String, val maxAge: Long)

    private companion object {
        const val LOGIN_PATH = "/api/staff/terminal/login"
        const val INTERNAL_PURCHASE_PATH = "/api/kiosk/terminal/internal-purchase"
        const val SESSION_COOKIE = "pli_terminal_session"
        const val MAX_SESSION_SECONDS = 30L * 24 * 60 * 60
    }
}

/**
 * Maps only the fixed internal-purchase protocol onto the durable coordinator. The lookup response
 * deliberately discards the server's internal user ID after validating it: later attempt creation
 * carries the confirmed phone, and the server re-resolves and signs its own recipient binding.
 */
class StaffSessionPurchaseApi(
    private val transport: StaffSessionTransport,
) : PurchaseApi {
    override fun lookup(session: StaffSession, phone: String): StudentLookupResult {
        val response = transport.postInternalPurchase(session, JSONObject().put("action", "student-lookup").put("phone", phone))
        return when (response.status) {
            200 -> {
                val root = json(response)
                val student = root.opt("student") as? JSONObject ?: throw IOException("Student lookup response is invalid")
                val id = student.opt("id") as? String ?: throw IOException("Student lookup response is invalid")
                if (id.isBlank()) throw IOException("Student lookup response is invalid")
                val name = when (val value = student.opt("name")) {
                    JSONObject.NULL -> null
                    is String -> value
                    else -> throw IOException("Student lookup response is invalid")
                }
                StudentLookupResult.Unique(MinimumStudentIdentity(name))
            }
            400 -> StudentLookupResult.Invalid
            404 -> StudentLookupResult.Missing
            409 -> StudentLookupResult.Ambiguous
            else -> throw IOException("Student lookup is unavailable")
        }
    }

    override fun preflight(session: StaffSession) {
        val response = transport.postInternalPurchase(session, JSONObject().put("action", "preflight"))
        require(response.status in 200..299) { "Internal purchase preflight failed" }
        Contract.preflight(json(response))
    }

    override fun issue(session: StaffSession, phone: String): AttemptTicket {
        val response = transport.postInternalPurchase(session, JSONObject().put("action", "attempt").put("phone", phone))
        require(response.status in 200..299) { "Student attempt creation failed" }
        val body = json(response)
        return AttemptTicket(
            value = requiredString(body, "ticket"),
            expiresAt = requiredLong(body, "expiresAt"),
            readerId = requiredString(body, "readerId"),
            locationId = requiredString(body, "locationId"),
        )
    }

    override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult = payment(
        session,
        JSONObject().put("action", "payment-intent").put("ticket", ticket.value),
        recovery = false,
    )

    override fun refreshCollection(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult = payment(
        session,
        JSONObject().put("action", "payment-intent").put("ticket", ticket.value).put("paymentIntentId", id),
        recovery = false,
    )

    override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult = payment(
        session,
        JSONObject().put("action", "recover").put("ticket", ticket.value).put("paymentIntentId", id),
        recovery = true,
    )

    private fun payment(session: StaffSession, action: JSONObject, recovery: Boolean): PaymentResult {
        val response = transport.postInternalPurchase(session, action)
        require(response.status in 200..299) { "Known payment recovery failed" }
        return Contract.payment(json(response), recovery)
    }

    private fun json(response: HttpResponse): JSONObject = try {
        JSONObject(response.body.decodeToString())
    } catch (error: Exception) {
        throw IOException("Internal purchase response is invalid", error)
    }

    private fun requiredString(value: JSONObject, key: String): String = value.opt(key) as? String
        ?: throw IOException("Internal purchase response is invalid")

    private fun requiredLong(value: JSONObject, key: String): Long = (value.opt(key) as? Number)?.toLong()
        ?: throw IOException("Internal purchase response is invalid")
}

data class HttpResponse(val status: Int, val headers: Map<String, List<String>>, val body: ByteArray)

/** Narrow transport seam for JVM tests; production always supplies the strict HTTPS implementation. */
internal interface StaffSessionHttpClient {
    fun post(endpoint: URL, body: ByteArray, sessionCookie: String?): HttpResponse
}

/** A small HTTPS-only client with no cookie jar and redirects disabled. */
internal class StrictHttpsClient : StaffSessionHttpClient {
    override fun post(endpoint: URL, body: ByteArray, sessionCookie: String?): HttpResponse {
        require(endpoint.protocol == "https" && endpoint.userInfo == null && endpoint.query == null && endpoint.ref.isNullOrEmpty()) {
            "Only a canonical HTTPS endpoint is allowed"
        }
        val connection = (endpoint.openConnection() as? HttpsURLConnection)
            ?: throw IOException("HTTPS connection is unavailable")
        connection.instanceFollowRedirects = false
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        if (sessionCookie != null) connection.setRequestProperty("Cookie", "$SESSION_COOKIE=$sessionCookie")
        try {
            connection.outputStream.use { output ->
                output.write(body)
                output.flush()
            }
            val status = connection.responseCode
            if (status in 300..399 || connection.getHeaderField("Location") != null) {
                throw IOException("Redirects are forbidden")
            }
            val stream = connection.errorStream ?: connection.inputStream
            val response = stream?.use(::readBounded) ?: ByteArray(0)
            return HttpResponse(status, connection.headerFields.mapValues { it.value.toList() }, response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (output.size() + read > MAX_RESPONSE_BYTES) throw IOException("Response is too large")
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }

    private companion object {
        const val SESSION_COOKIE = "pli_terminal_session"
        const val MAX_RESPONSE_BYTES = 64 * 1024
    }
}
