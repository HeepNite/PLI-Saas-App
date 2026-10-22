package com.pli.kiosk.android

import com.stripe.stripeterminal.Terminal

/**
 * The only terminal seam available to the operator and lifecycle code. It deliberately has no
 * create, collect, or confirm operation: N5 cannot collect a payment.
 */
interface TerminalAdapter {
    fun currentReader(): ConnectedReader?
    fun manualReconnect(): ConnectedReader?
}

/**
 * Production SDK boundary. Terminal access is intentionally inert until a separately authorized
 * collection unit exists; it cannot establish collection authority or invoke collection APIs.
 */
class StripeTerminalAdapter(
    @Suppress("unused") private val terminal: Terminal,
) : TerminalAdapter {
    override fun currentReader(): ConnectedReader? = null

    override fun manualReconnect(): ConnectedReader? = null
}

data class ServerAuthorizedCollectionContext(
    val authorizationId: String,
    val sessionAssociation: String,
    val readerId: String,
    val expiresAt: Long,
)

/** The future server call is a seam only; N5 supplies fakes and performs no operational network I/O. */
interface CollectionAuthorization {
    fun authorize(session: StaffSession, reader: ConnectedReader): ServerAuthorizedCollectionContext
}

enum class CollectionInvalidation {
    READER_DISCONNECTED,
    APPLICATION_BACKGROUNDED,
    APPLICATION_RESUMED,
    SESSION_CHANGED,
    CONFIGURED_READER_CHANGED,
    OBSERVED_READER_CHANGED,
    CONTEXT_EXPIRED,
    MANUAL_RECONNECT,
}

/**
 * Tracks only eligibility prerequisites for a later, separately authorized unit. Its public
 * collection flag is permanently false, even when a fake server context is current.
 */
class CollectionLifecycleCoordinator(
    private val terminal: TerminalAdapter,
    private val authorization: CollectionAuthorization,
    private val clock: () -> Long,
    private val unresolvedAttempt: () -> AttemptState? = { null },
) {
    private var context: ServerAuthorizedCollectionContext? = null
    var requiresManualReconnect: Boolean = false
        private set
    var lastInvalidation: CollectionInvalidation? = null
        private set

    /** N5 has no collection path. This must remain false regardless of lifecycle state. */
    val collectionEnabled: Boolean get() = false

    /** Read-only recovery affordance; lifecycle events never modify durable attempt state. */
    val knownAttemptId: String? get() = unresolvedAttempt()?.paymentIntentId

    @Synchronized
    fun onReaderDisconnected() = invalidate(CollectionInvalidation.READER_DISCONNECTED, manualReconnect = true)

    @Synchronized
    fun onApplicationBackgrounded() = invalidate(CollectionInvalidation.APPLICATION_BACKGROUNDED)

    @Synchronized
    fun onApplicationResumed() = invalidate(CollectionInvalidation.APPLICATION_RESUMED)

    @Synchronized
    fun onAuthenticatedSessionChanged() = invalidate(CollectionInvalidation.SESSION_CHANGED)

    @Synchronized
    fun onConfiguredReaderChanged() = invalidate(CollectionInvalidation.CONFIGURED_READER_CHANGED)

    @Synchronized
    fun onObservedReaderChanged() = invalidate(CollectionInvalidation.OBSERVED_READER_CHANGED, manualReconnect = true)

    @Synchronized
    fun onContextExpired() = invalidate(CollectionInvalidation.CONTEXT_EXPIRED)

    /** This is the sole reconnect entry point and is always explicit; no event reconnects implicitly. */
    @Synchronized
    fun manualReconnect() {
        context = null
        lastInvalidation = CollectionInvalidation.MANUAL_RECONNECT
        requiresManualReconnect = terminal.manualReconnect() == null
    }

    /**
     * Replaces rather than reuses context after the caller has performed any required reconnect.
     * This does not enable collection; it establishes only future prerequisites.
     */
    @Synchronized
    fun refreshAuthorization(session: StaffSession, configuredReaderId: String) {
        require(!requiresManualReconnect) { "Manual BLE reconnect is required" }
        validateSession(session)
        val reader = requireNotNull(terminal.currentReader()) { "No reader is currently connected" }
        require(ReaderPolicy.matchesConfigured(reader, configuredReaderId)) { "Current reader is not approved" }
        val fresh = authorization.authorize(session, reader)
        require(fresh.authorizationId.isNotBlank()) { "Server authorization is missing" }
        require(fresh.sessionAssociation == session.association) { "Server authorization session changed" }
        require(fresh.readerId == reader.id && fresh.readerId == configuredReaderId) {
            "Server authorization reader changed"
        }
        require(fresh.expiresAt > clock()) { "Server authorization is already expired" }
        context = fresh
        lastInvalidation = null
    }

    /** Checks the current physical reader/session/context triple without invoking the SDK. */
    @Synchronized
    fun hasFreshContext(session: StaffSession, configuredReaderId: String): Boolean {
        val current = context ?: return false
        if (current.expiresAt <= clock()) {
            invalidate(CollectionInvalidation.CONTEXT_EXPIRED)
            return false
        }
        if (session.expiresAt <= clock() || current.sessionAssociation != session.association) {
            invalidate(CollectionInvalidation.SESSION_CHANGED)
            return false
        }
        val reader = terminal.currentReader()
        if (reader == null) {
            invalidate(CollectionInvalidation.READER_DISCONNECTED, manualReconnect = true)
            return false
        }
        if (!ReaderPolicy.matchesConfigured(reader, configuredReaderId)) {
            invalidate(CollectionInvalidation.OBSERVED_READER_CHANGED, manualReconnect = true)
            return false
        }
        if (current.readerId != reader.id || current.readerId != configuredReaderId) {
            invalidate(CollectionInvalidation.CONFIGURED_READER_CHANGED)
            return false
        }
        return !requiresManualReconnect
    }

    private fun invalidate(reason: CollectionInvalidation, manualReconnect: Boolean = false) {
        context = null
        lastInvalidation = reason
        requiresManualReconnect = requiresManualReconnect || manualReconnect
    }

    private fun validateSession(session: StaffSession) {
        require(session.association.isNotBlank() && session.expiresAt > clock()) { "Current staff session is unavailable" }
    }
}
