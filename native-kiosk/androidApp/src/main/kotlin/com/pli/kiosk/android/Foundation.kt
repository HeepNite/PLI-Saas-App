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
class PurchaseCoordinator(
    private val approvedOrigin: ApprovedOrigin,
    private val store: StateStore,
    private val api: PurchaseApi,
    private val clock: () -> Long,
) : StudentSelectionActions {
    companion object {
        // One kiosk process must not issue/recover two attempts concurrently through separate controllers.
        private val operationLock = ReentrantLock()
    }

    private var poisoned = false
    /** Ephemeral UI-only selection. Durable state retains only the server-signed attempt ticket. */
    private var pendingPhone: String? = null
    private var confirmedPhone: String? = null
    var selectedStudent: MinimumStudentIdentity? = null
        private set
    val collectionEnabled: Boolean get() = false
    /** UI may enable only explicit ticket issuance after a unique student confirmation. */
    val canBeginAttempt: Boolean get() = confirmedPhone != null && selectedStudent != null

    /** Internal composition seam; the opaque value is never returned through UI state. */
    internal fun retainedTicketForNativeRuntime(): AttemptTicket = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(!attempt.resolved) { "Resolved records remain retained without a reset operation" }
        requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
    }

    internal fun hasKnownPaymentIntent(): Boolean = exclusive {
        load().attempt?.paymentIntentId != null
    }

    /** UI eligibility only; all state is revalidated again when lookup executes. */
    fun studentLookupEnabled(): Boolean = exclusive {
        val state = load()
        state.attempt == null && state.session?.let {
            runCatching { validateSession(it) }.isSuccess
        } == true
    }

    /** A later lookup always supersedes prior confirmation while no attempt exists. */
    override fun lookupStudent(phone: String): StudentLookupResult = exclusive {
        val state = load()
        require(state.attempt == null) { "A recipient cannot change after attempt creation" }
        originalSession(state)
        confirmedPhone = null
        pendingPhone = null
        selectedStudent = null
        val result = api.lookup(requireNotNull(state.session), phone)
        when (result) {
            is StudentLookupResult.Unique -> {
                pendingPhone = phone
                selectedStudent = result.student
            }
            else -> Unit
        }
        result
    }

    /** Requires an explicit operator acknowledgement of the minimum identity before a signed attempt. */
    override fun confirmSelectedStudent(): MinimumStudentIdentity = exclusive {
        require(pendingPhone != null && selectedStudent != null) { "A unique student must be selected first" }
        confirmedPhone = pendingPhone
        requireNotNull(selectedStudent)
    }

    fun start(): Outcome = exclusive { performStart() }

    /**
     * Returns only the SDK handoff for one pending, durably retained PaymentIntent. The secret is
     * validated before return and is never copied into [DurableState].
     */
    fun startCollection(): TransientCollectionStart = exclusive { performCollectionStart() }

    fun resume(): Outcome = exclusive { performResume() }

    /** Read-only known-attempt reconciliation; it never issues or prepares a replacement intent. */
    fun recoverKnownAttempt(): Outcome = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(!attempt.resolved) { "Resolved records remain retained without a reset operation" }
        val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        val id = requireNotNull(attempt.paymentIntentId) { "No known PaymentIntent exists to recover" }
        accept(session, attempt, api.recover(session, ticket, id))
    }

    fun login(login: () -> StaffSession): StaffSession = exclusive {
        val state = load()
        require(state.attempt == null) { "A retained attempt cannot be replaced by login" }
        val session = login()
        validateSession(session)
        pendingPhone = null
        confirmedPhone = null
        selectedStudent = null
        persist(DurableState(session = session))
        session
    }

    /** SDK callbacks are intentionally non-authoritative until native unit 2 obtains server recovery. */
    fun sdkCompleted(paymentIntentId: String, succeeded: Boolean): Outcome = Outcome.DISABLED

    private inline fun <T> exclusive(block: () -> T): T {
        check(operationLock.tryLock()) { "A purchase action is already in progress" }
        return try {
            block()
        } finally {
            operationLock.unlock()
        }
    }

    private fun performStart(): Outcome {
        val state = load()
        val session = originalSession(state)
        val attempt = state.attempt
        if (attempt != null) {
            require(!attempt.resolved) { "A resolved record has no reset operation" }
            validateBinding(session, attempt)
            // Issuing a ticket is the last legal action before explicit reader binding.
            // A retained ticket or ID is resumed/recovered by its dedicated paths, never reissued.
            return Outcome.PENDING
        }

        val phone = requireNotNull(confirmedPhone) { "Explicit student confirmation is required before attempt creation" }
        api.preflight(session)
        // Persist an issuance marker first. Losing the issue response requires reconciliation, not reissue.
        // It intentionally holds no phone or displayed identity; the returned ticket is the signed recipient binding.
        val marker = AttemptState(null, session.association, session.origin)
        persist(DurableState(session, marker))
        val ticket = try {
            api.issue(session, phone)
        } finally {
            pendingPhone = null
            confirmedPhone = null
            selectedStudent = null
        }
        validateNewTicket(ticket)
        val retained = marker.copy(ticket = ticket)
        persist(DurableState(session, retained))
        // PaymentIntent creation is intentionally deferred until a compliant reader is connected
        // and startCollection obtains fresh server collection context.
        return Outcome.PENDING
    }

    private fun performCollectionStart(): TransientCollectionStart {
        val state = load()
        val session = originalSession(state)
        val attempt = state.attempt
        if (attempt != null) {
            require(!attempt.resolved) { "A paid attempt cannot be collected" }
            validateBinding(session, attempt)
            val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
            val id = attempt.paymentIntentId
            if (id != null) {
                return collectionStart(session, attempt, api.refreshCollection(session, ticket, id))
            }
            require(ticket.expiresAt > clock()) { "The unknown ticket expired; reconcile with an operator" }
            return collectionStart(session, attempt, api.prepare(session, ticket))
        }

        throw IllegalStateException("A durable signed ticket and validated reader are required before collection")
    }

    private fun collectionStart(session: StaffSession, attempt: AttemptState, payment: PaymentResult): TransientCollectionStart {
        require(payment.id.isNotBlank()) { "The server returned no PaymentIntent ID" }
        require((payment.status == "succeeded") == payment.paid) { "The server payment result is inconsistent" }
        require(attempt.paymentIntentId == null || attempt.paymentIntentId == payment.id) {
            "The refreshed PaymentIntent does not match the retained identity"
        }
        require(!payment.paid) { "A paid PaymentIntent cannot be collected" }
        val secret = requireNotNull(payment.clientSecret) { "The server returned no collection client secret" }
        require(secret.isNotBlank()) { "The server returned no collection client secret" }
        require(accept(session, attempt, payment) == Outcome.PENDING) { "A paid PaymentIntent cannot be collected" }
        return TransientCollectionStart(DurableAttempt(requireNotNull(attempt.ticket), payment.id), secret)
    }

    private fun performResume(): Outcome {
        val state = load()
        val session = originalSession(state)
        val attempt = state.attempt ?: throw IllegalStateException("No retained attempt exists")
        validateBinding(session, attempt)
        require(!attempt.resolved) { "Resolved records remain retained without a reset operation" }
        requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        return if (attempt.paymentIntentId != null) {
            continueAttempt(session, attempt)
        } else {
            // Ticket-only restart must wait for a new explicit reader connection before creation.
            Outcome.PENDING
        }
    }

    private fun continueAttempt(session: StaffSession, attempt: AttemptState): Outcome {
        val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        val id = requireNotNull(attempt.paymentIntentId) { "No known PaymentIntent exists to recover" }
        return accept(session, attempt, api.recover(session, ticket, id))
    }

    private fun accept(session: StaffSession, attempt: AttemptState, payment: PaymentResult): Outcome {
        require(payment.id.isNotBlank()) { "The server returned no PaymentIntent ID" }
        require((payment.status == "succeeded") == payment.paid) { "The server payment result is inconsistent" }
        require(attempt.paymentIntentId == null || attempt.paymentIntentId == payment.id) {
            "The recovered PaymentIntent does not match the retained identity"
        }
        // Do not copy payment.clientSecret into durable state. This unit cannot collect.
        val next = attempt.copy(paymentIntentId = payment.id, resolved = payment.paid)
        persist(DurableState(session, next))
        return if (payment.paid) Outcome.PAID else Outcome.PENDING
    }

    private fun load(): DurableState {
        check(!poisoned) { "The coordinator is poisoned after a durable-state failure" }
        return try {
            store.read().also(::validateState)
        } catch (error: Exception) {
            poisoned = true
            throw IllegalStateException("Durable state is unavailable or corrupt", error)
        }
    }

    private fun persist(state: DurableState) {
        check(!poisoned) { "The coordinator is poisoned after a durable-state failure" }
        try {
            store.write(state)
        } catch (error: Exception) {
            poisoned = true
            throw IllegalStateException("Durable state could not be written", error)
        }
    }

    private fun originalSession(state: DurableState): StaffSession = requireNotNull(state.session) {
        "The original staff session is unavailable; reconcile with an operator"
    }.also(::validateSession)

    private fun validateState(state: DurableState) {
        state.session?.let(::validateSession)
        val attempt = state.attempt ?: return
        val session = requireNotNull(state.session) { "An attempt requires its original session" }
        validateBinding(session, attempt)
        if (attempt.resolved) require(attempt.paymentIntentId != null) { "Resolved attempt lacks a payment ID" }
        attempt.ticket?.let(::validateTicket)
        if (attempt.paymentIntentId != null) require(attempt.paymentIntentId.isNotBlank()) { "Invalid payment ID" }
    }

    private fun validateSession(session: StaffSession) {
        require(session.origin == approvedOrigin.value) { "Session origin does not match the approved origin" }
        require(session.association.isNotBlank() && session.cookie.isNotBlank()) { "Session binding is missing" }
        require(session.expiresAt > clock()) { "The original staff session expired" }
    }

    private fun validateBinding(session: StaffSession, attempt: AttemptState) {
        require(attempt.origin == approvedOrigin.value && attempt.origin == session.origin) { "Attempt origin changed" }
        require(attempt.sessionAssociation == session.association) { "Attempt session changed" }
    }

    private fun validateNewTicket(ticket: AttemptTicket) {
        validateTicket(ticket)
        require(ticket.expiresAt > clock()) { "The issued ticket is already expired" }
    }

    private fun validateTicket(ticket: AttemptTicket) {
        require(ticket.value.isNotBlank() && ticket.readerId.isNotBlank()) { "Invalid attempt ticket" }
        require(ticket.locationId == Approved.LOCATION) { "Ticket location is not approved" }
    }
}

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
        require(payload.opt("paymentCreationEnabled") is Boolean) { "Invalid payment gate" }
        if (payload.has("livemode")) require(payload.opt("livemode") == true) { "The server is not LIVE" }
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
