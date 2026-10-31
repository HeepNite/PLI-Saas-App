package com.pli.kiosk.android

import java.io.IOException
import java.util.concurrent.locks.ReentrantLock

/** Values returned by the approved server preflight; they are not device configuration. */
object Approved {
    const val LOCATION = "tml_GqQ6wPY5rSAhAt"
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

enum class AttemptMode { LEGACY, PREPARED }

data class AttemptState(
    val ticket: AttemptTicket?,
    val sessionAssociation: String,
    val origin: String,
    val paymentIntentId: String? = null,
    val resolved: Boolean = false,
    val mode: AttemptMode = AttemptMode.LEGACY,
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

/** Provider-free server authority for one retained ticket-only prepared attempt. */
enum class PreparedCreationStatus { UNCREATED, CREATED }

/** Exact-total native admission: the only purchase protocol the kiosk speaks. */
interface PreparedPurchaseApi {
    fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String): AttemptTicket
    fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String? = null): PaymentResult
    fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult
    /** Existing prepared API fakes remain fail-closed until they explicitly support this narrow action. */
    fun preparedCreationStatus(session: StaffSession, ticket: AttemptTicket): PreparedCreationStatus =
        throw UnsupportedOperationException("Prepared creation status is unavailable")
    /**
     * Asks the server to cancel the exact retained PaymentIntent only if Stripe confirms it was not
     * charged. Returns its resulting status: canceled, succeeded (paid), or anything else (pending).
     */
    fun preparedCancel(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): PaymentResult =
        throw UnsupportedOperationException("Prepared cancel is unavailable")
}

enum class Outcome { PENDING, PAID }

/** Server answer to a prepared cancel. Only [CANCELED] frees the kiosk; [PENDING] keeps it locked. */
enum class PreparedCancelOutcome { CANCELED, PAID, PENDING }

/** In-session ticket-only resolution: only [CLEARED] frees the kiosk directly. */
enum class TicketOnlyResolution { CLEARED, RECOVERED_PENDING, RECOVERED_PAID }

/**
 * Coordinates the one retained server-signed prepared ticket. A retained [AttemptMode.LEGACY]
 * attempt still decodes, but fails closed: it is never collected, recovered, or auto-cleared.
 */
class PurchaseCoordinator(
    private val approvedOrigin: ApprovedOrigin,
    private val store: StateStore,
    private val preparedApi: PreparedPurchaseApi,
    private val clock: () -> Long,
) {
    companion object {
        // One kiosk process must not issue/recover two attempts concurrently through separate controllers.
        private val operationLock = ReentrantLock()
    }

    private var poisoned = false

    /** Internal composition only; this exposes no ticket beyond native code. */
    internal fun retainedPreparedAttemptForNativeRuntime(): AttemptState = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(attempt.mode == AttemptMode.PREPARED && !attempt.resolved) { "No unresolved prepared attempt exists" }
        requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        attempt
    }

    internal fun hasKnownPaymentIntent(): Boolean = exclusive {
        load().attempt?.paymentIntentId != null
    }

    /** Admits one opaque exact-total purchase without retaining its one-use reference. */
    fun startPrepared(preparedPurchaseReference: String): Outcome = exclusive {
        validatePreparedReference(preparedPurchaseReference)
        val state = load()
        val session = originalSession(state)
        require(state.attempt == null) { "A retained attempt requires reconciliation" }
        // Persist before the external issue request; a lost response must never be replayed.
        val marker = AttemptState(null, session.association, session.origin, mode = AttemptMode.PREPARED)
        persist(DurableState(session, marker))
        val ticket = preparedApi.preparedAttempt(session, preparedPurchaseReference)
        validateNewTicket(ticket)
        persist(DurableState(session, marker.copy(ticket = ticket)))
        Outcome.PENDING
    }

    /**
     * Returns only the SDK handoff for one pending, durably retained PaymentIntent. The secret is
     * validated before return and is never copied into [DurableState].
     */
    fun startCollection(): TransientCollectionStart = exclusive { performCollectionStart() }

    /** Read-only known-attempt reconciliation; it never issues or prepares a replacement intent. */
    fun recoverKnownAttempt(): Outcome = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(!attempt.resolved) { "Resolved records remain retained without a reset operation" }
        val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        val id = requireNotNull(attempt.paymentIntentId) { "No known PaymentIntent exists to recover" }
        accept(session, attempt, recover(session, attempt, ticket, id))
    }

    /**
     * Startup-only recovery validates the exact retained payment without mutating durable state.
     * The caller may clear only after this returns [Outcome.PAID].
     */
    internal fun recoverKnownPreparedAttemptForStartup(): Outcome = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(attempt.mode == AttemptMode.PREPARED && !attempt.resolved) {
            "Startup recovery requires one unresolved prepared attempt"
        }
        val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        val id = requireNotNull(attempt.paymentIntentId) { "No known PaymentIntent exists to recover" }
        val next = validatedRecoveredAttempt(attempt, recover(session, attempt, ticket, id))
        if (next.resolved) Outcome.PAID else Outcome.PENDING
    }

    /** Clears only a server-confirmed prepared payment so the same kiosk session can admit a new sale. */
    internal fun clearResolvedPreparedAttempt(): Unit = exclusive {
        val state = load(allowExpiredSession = true)
        val session = requireNotNull(state.session) { "The original staff session is unavailable" }
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        require(attempt.mode == AttemptMode.PREPARED && attempt.resolved) {
            "Only a resolved prepared attempt may roll over"
        }
        persist(DurableState(session))
    }

    /**
     * Owner decision 2026-10-27: a not-paid prepared attempt is cleared only after the server
     * confirms Stripe canceled its exact PaymentIntent uncharged. The clear is persisted and read
     * back before returning, so no new sale can start on a non-durable clear. A paid answer is
     * persisted as resolved for the existing paid rollover; anything else keeps the attempt.
     */
    internal fun cancelUnpaidPreparedAttempt(): PreparedCancelOutcome = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(attempt.mode == AttemptMode.PREPARED && !attempt.resolved) { "No unresolved prepared attempt exists" }
        val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        val id = requireNotNull(attempt.paymentIntentId) { "No known PaymentIntent exists to cancel" }
        val payment = preparedApi.preparedCancel(session, ticket, id)
        val next = validatedRecoveredAttempt(attempt, payment)
        when {
            next.resolved -> {
                persist(DurableState(session, next))
                PreparedCancelOutcome.PAID
            }
            payment.status == "canceled" -> {
                persistReadBackClear(session)
                PreparedCancelOutcome.CANCELED
            }
            else -> PreparedCancelOutcome.PENDING
        }
    }

    /**
     * In-session counterpart of the startup creation-status recovery for a sale that failed after
     * ticket issuance but before its PaymentIntent identity was retained. UNCREATED clears durably
     * (read back); CREATED only recovers and persists the exact PaymentIntent so the caller settles
     * it through the existing not-paid cancel or paid rollover. Failures keep the attempt retained.
     */
    internal fun resolveTicketOnlyPreparedAttempt(): TicketOnlyResolution = exclusive {
        val state = load()
        val session = originalSession(state)
        val attempt = requireNotNull(state.attempt) { "No retained attempt exists" }
        validateBinding(session, attempt)
        require(attempt.mode == AttemptMode.PREPARED && !attempt.resolved && attempt.paymentIntentId == null) {
            "No unresolved ticket-only prepared attempt exists"
        }
        val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
        when (preparedApi.preparedCreationStatus(session, ticket)) {
            PreparedCreationStatus.UNCREATED -> {
                persistReadBackClear(session)
                TicketOnlyResolution.CLEARED
            }
            PreparedCreationStatus.CREATED ->
                if (accept(session, attempt, preparedApi.preparedPaymentIntent(session, ticket)) == Outcome.PAID) {
                    TicketOnlyResolution.RECOVERED_PAID
                } else {
                    TicketOnlyResolution.RECOVERED_PENDING
                }
        }
    }

    private fun persistReadBackClear(session: StaffSession) {
        val cleared = DurableState(session)
        persist(cleared)
        check(load() == cleared) { "Prepared rollover was not durable" }
    }

    /** Identifier-free category for a refused prepared admission (diagnostics only; never mutates). */
    internal fun preparedAdmissionBlocker(): String {
        if (!operationLock.tryLock()) return "busy"
        return try {
            val state = if (poisoned) null else runCatching { store.read() }.getOrNull()
            val session = state?.session
            when {
                poisoned -> "poisoned"
                state == null -> "store_unavailable"
                session == null -> "session_missing"
                session.expiresAt <= clock() -> "session_expired"
                state.attempt != null -> "attempt_retained"
                else -> "other"
            }
        } finally {
            operationLock.unlock()
        }
    }

    fun login(login: () -> StaffSession): StaffSession = exclusive {
        val state = load(allowExpiredSession = true)
        require(state.attempt == null) { "A retained attempt cannot be replaced by login" }
        val session = login()
        validateSession(session)
        persist(DurableState(session = session))
        session
    }

    private inline fun <T> exclusive(block: () -> T): T {
        check(operationLock.tryLock()) { "A purchase action is already in progress" }
        return try {
            block()
        } finally {
            operationLock.unlock()
        }
    }

    private fun performCollectionStart(): TransientCollectionStart {
        val state = load()
        val session = originalSession(state)
        val attempt = state.attempt
        if (attempt != null) {
            require(!attempt.resolved) { "A paid attempt cannot be collected" }
            validateBinding(session, attempt)
            requirePrepared(attempt)
            val ticket = requireNotNull(attempt.ticket) { "Ticket issuance outcome is unknown; reconcile with an operator" }
            val id = attempt.paymentIntentId
            if (id != null) return collectionStart(session, attempt, preparedApi.preparedPaymentIntent(session, ticket, id))
            require(ticket.expiresAt > clock()) { "The unknown ticket expired; reconcile with an operator" }
            return collectionStart(session, attempt, preparedApi.preparedPaymentIntent(session, ticket))
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

    private fun recover(session: StaffSession, attempt: AttemptState, ticket: AttemptTicket, id: String): PaymentResult {
        requirePrepared(attempt)
        return preparedApi.preparedRecover(session, ticket, id)
    }

    /** A decoded legacy attempt is retained for operator reconciliation and never sent to the server. */
    private fun requirePrepared(attempt: AttemptState) =
        require(attempt.mode == AttemptMode.PREPARED) { "Legacy attempts are not supported; reconcile with an operator" }

    private fun accept(session: StaffSession, attempt: AttemptState, payment: PaymentResult): Outcome {
        val next = validatedRecoveredAttempt(attempt, payment)
        persist(DurableState(session, next))
        return if (next.resolved) Outcome.PAID else Outcome.PENDING
    }

    private fun validatedRecoveredAttempt(attempt: AttemptState, payment: PaymentResult): AttemptState {
        require(payment.id.isNotBlank()) { "The server returned no PaymentIntent ID" }
        require((payment.status == "succeeded") == payment.paid) { "The server payment result is inconsistent" }
        require(attempt.paymentIntentId == null || attempt.paymentIntentId == payment.id) {
            "The recovered PaymentIntent does not match the retained identity"
        }
        // Do not copy payment.clientSecret into durable state. This unit cannot collect.
        return attempt.copy(paymentIntentId = payment.id, resolved = payment.paid)
    }

    private fun load(allowExpiredSession: Boolean = false): DurableState {
        check(!poisoned) { "The coordinator is poisoned after a durable-state failure" }
        val state = try {
            store.read().also { validateState(it, allowExpiredSession = true) }
        } catch (error: Exception) {
            poisoned = true
            throw IllegalStateException("Durable state is unavailable or corrupt", error)
        }
        // An expired session is valid state awaiting renewal, not corruption: refuse without poisoning.
        if (!allowExpiredSession) state.session?.let(::validateSession)
        return state
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

    private fun validateState(state: DurableState, allowExpiredSession: Boolean = false) {
        state.session?.let { validateSession(it, allowExpiredSession) }
        val attempt = state.attempt ?: return
        val session = requireNotNull(state.session) { "An attempt requires its original session" }
        validateBinding(session, attempt)
        if (attempt.resolved) require(attempt.paymentIntentId != null && attempt.ticket != null) { "Resolved attempt lacks payment state" }
        if (attempt.ticket == null) require(attempt.paymentIntentId == null && !attempt.resolved) { "Ticketless attempt has payment state" }
        attempt.ticket?.let(::validateTicket)
        if (attempt.paymentIntentId != null) require(attempt.paymentIntentId.isNotBlank()) { "Invalid payment ID" }
    }

    private fun validateSession(session: StaffSession, allowExpired: Boolean = false) {
        require(session.origin == approvedOrigin.value) { "Session origin does not match the approved origin" }
        require(session.association.isNotBlank() && session.cookie.isNotBlank()) { "Session binding is missing" }
        require(allowExpired || session.expiresAt > clock()) { "The original staff session expired" }
    }

    private fun validateBinding(session: StaffSession, attempt: AttemptState) {
        require(attempt.origin == approvedOrigin.value && attempt.origin == session.origin) { "Attempt origin changed" }
        require(attempt.sessionAssociation == session.association) { "Attempt session changed" }
    }

    private fun validatePreparedReference(reference: String) {
        require(reference.length == 43 && reference.all { it.isLetterOrDigit() || it == '-' || it == '_' }) {
            "Invalid prepared purchase reference"
        }
        val decoded = try {
            java.util.Base64.getUrlDecoder().decode(reference)
        } catch (error: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid prepared purchase reference", error)
        }
        require(decoded.size == 32 && java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(decoded) == reference) {
            "Invalid prepared purchase reference"
        }
    }

    private fun validateNewTicket(ticket: AttemptTicket) {
        validateTicket(ticket)
        require(ticket.expiresAt > clock()) { "The issued ticket is already expired" }
    }

    private fun validateTicket(ticket: AttemptTicket) {
        require(ticket.value.isNotBlank() && ticket.readerId.isNotBlank() && ticket.expiresAt > 0L) {
            "Invalid attempt ticket"
        }
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
    fun attemptTicket(ticket: AttemptTicket) {
        require(ticket.value.isNotBlank() && ticket.readerId.isNotBlank() && ticket.expiresAt > 0) { "Invalid attempt ticket" }
        require(ticket.locationId == Approved.LOCATION) { "Ticket location is not approved" }
    }
}
