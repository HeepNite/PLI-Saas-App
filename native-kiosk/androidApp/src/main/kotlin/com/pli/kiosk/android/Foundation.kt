package com.pli.kiosk.android

import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.locks.ReentrantLock

/** Values returned by the approved server preflight; they are not device configuration. */
object Approved {
    const val ACCOUNT = "acct_1PWRzcRtYdjwed35"
    const val PRODUCT = "prod_VJV0rf6b1sjK9x"
    const val PRICE = "price_1UIs02RtYdjwed35ZB3jho1F"
    const val LOCATION = "tml_GqQ6wPY5rSAhAt"
    const val AMOUNT = 100L
    const val CURRENCY = "usd"
    const val M2_SERIAL = "STRM2D533025669"
}

class ApprovedOrigin(value: String) {
    val value: String

    init {
        val uri = try {
            java.net.URI(value)
        } catch (error: Exception) {
            throw IllegalArgumentException("The approved origin is invalid", error)
        }
        require(uri.scheme == "https" && uri.isAbsolute) { "The approved origin must use HTTPS" }
        require(uri.host != null && uri.userInfo == null && uri.port == -1) { "The approved origin has an invalid authority" }
        require(uri.path.isNullOrEmpty() && uri.query == null && uri.fragment == null) { "The approved origin must not contain a path" }
        this.value = uri.toASCIIString()
    }
}

data class StaffSession(
    val origin: String,
    /** Stable association retained with an attempt, never sent as a second credential. */
    val association: String,
    /** Value of the original HttpOnly pli_terminal_session cookie. */
    val cookie: String,
    val expiresAt: Long,
)

data class AttemptTicket(
    val value: String,
    val expiresAt: Long,
    val readerId: String,
    val locationId: String,
)

data class AttemptState(
    val ticket: AttemptTicket?,
    val sessionAssociation: String,
    val origin: String,
    val paymentIntentId: String? = null,
    val resolved: Boolean = false,
)

data class DurableState(
    val session: StaffSession? = null,
    val attempt: AttemptState? = null,
)

/** State stores must fail closed: malformed or unavailable state is never equivalent to empty state. */
interface StateStore {
    @Throws(IOException::class)
    fun read(): DurableState

    @Throws(IOException::class)
    fun write(state: DurableState)
}

data class PaymentResult(
    val id: String,
    val status: String,
    val paid: Boolean,
    /** Collection-only, transient data. PurchaseCoordinator deliberately does not retain it. */
    val clientSecret: String? = null,
)

/** The sole identity displayed for an existing student; IDs and phone numbers never leave this boundary. */
data class MinimumStudentIdentity(val name: String?)

/** Lookup failures are explicit and cannot be treated as a selection. */
sealed interface StudentLookupResult {
    data class Unique(val student: MinimumStudentIdentity) : StudentLookupResult
    data object Missing : StudentLookupResult
    data object Invalid : StudentLookupResult
    data object Ambiguous : StudentLookupResult
}

interface PurchaseApi {
    fun lookup(session: StaffSession, phone: String): StudentLookupResult
    fun preflight(session: StaffSession)
    /** The server re-resolves this confirmed phone and signs the recipient into the returned ticket. */
    fun issue(session: StaffSession, phone: String): AttemptTicket
    fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult
    /** Refreshes transient collection data for the one already-durable PaymentIntent identity. */
    fun refreshCollection(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult =
        throw UnsupportedOperationException("Collection refresh is unavailable")
    fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult
}

enum class Outcome { PENDING, PAID, DISABLED }

/** UI seam: implementations may expose only lookup and explicit confirmation, never a student ID. */
interface StudentSelectionActions {
    fun lookupStudent(phone: String): StudentLookupResult
    fun confirmSelectedStudent(): MinimumStudentIdentity
}

/**
 * Coordinates the one retained server-signed ticket. It has no SDK collection entry point;
 * hardware collection belongs to the later native unit.
 */
data class ConnectedReader(val id: String, val serial: String, val type: String, val location: String)

object ReaderPolicy {
    /** Discovery/location claims are insufficient: every physical reader property must match. */
    fun matches(reader: ConnectedReader, ticket: AttemptTicket, provisionedReaderId: String?): Boolean =
        provisionedReaderId != null &&
            reader.id == provisionedReaderId &&
            reader.id == ticket.readerId &&
            matchesConfigured(reader, provisionedReaderId) &&
            reader.location == ticket.locationId &&
            ticket.locationId == Approved.LOCATION

    /** N5 validates the configured/current physical reader before accepting a fresh context. */
    fun matchesConfigured(reader: ConnectedReader, configuredReaderId: String): Boolean =
        reader.id == configuredReaderId &&
            reader.serial == Approved.M2_SERIAL &&
            reader.type == "stripe_m2" &&
            reader.location == Approved.LOCATION
}

object Contract {
    fun preflight(payload: JSONObject) {
        string(payload, "accountId", Approved.ACCOUNT)
        string(payload, "productId", Approved.PRODUCT)
        string(payload, "priceId", Approved.PRICE)
        string(payload, "locationId", Approved.LOCATION)
        string(payload, "currency", Approved.CURRENCY)
        require(payload.opt("amount") is Number && payload.getLong("amount") == Approved.AMOUNT) { "Invalid amount" }
        require(payload.opt("paymentCreationEnabled") == true) { "Payment creation is disabled" }
        require(payload.opt("livemode") == true) { "The server is not LIVE" }
    }

    /** `recovery` rejects a client secret even if the server accidentally sends one. */
    fun payment(payload: JSONObject, recovery: Boolean): PaymentResult {
        val id = payload.opt("id") as? String ?: throw IllegalArgumentException("Missing payment ID")
        val status = payload.opt("status") as? String ?: throw IllegalArgumentException("Missing payment status")
        val paid = payload.opt("paid") as? Boolean ?: throw IllegalArgumentException("Missing paid status")
        require(id.isNotBlank() && (status == "succeeded") == paid) { "Inconsistent payment response" }
        val secret = if (payload.has("clientSecret")) payload.opt("clientSecret") as? String else null
        require(secret == null || (!recovery && secret.isNotBlank())) { "Client secret is not allowed for recovery" }
        return PaymentResult(id, status, paid, secret)
    }

    private fun string(payload: JSONObject, key: String, expected: String) {
        require(payload.opt(key) is String && payload.getString(key) == expected) { "Invalid $key" }
    }
}
