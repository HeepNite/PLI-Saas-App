package com.pli.kiosk.android

interface ReaderConnectionLifecycle {
    fun start()
    fun onBluetoothPermissionResult(granted: Boolean)
    fun invalidate()
    /** A sale's own discovery supersedes in-flight owner discovery; a READY reader stays reusable. */
    fun retireDiscovery() = Unit
}

/** Coarse reader readiness the kiosk page may learn; it carries no reader identity. */
enum class ReaderStatus { CONNECTED, CONNECTING, DISCONNECTED }

/**
 * Keeps the exact provisioned M2 connected for one foreground kiosk Activity: it connects at start,
 * lets the SDK auto-reconnect, and retries discovery with bounded backoff for as long as it is not
 * stopped. It cannot create or mutate payment state: every payment remains owned by a later signed
 * prepared operation, which reuses this connection through the adapter's reuse branch.
 */
class ReaderConnectionOwner(
    private val terminal: NativeTerminalAdapter,
    private val permissions: BluetoothPermissions,
    private val connectionTokenProvider: () -> String,
    private val provisionedReaderId: String,
    private val locationId: String,
    private val scheduler: CollectionDeadlineScheduler,
    private val onStatus: (ReaderStatus) -> Unit = {},
    private val onReaderInputRequested: () -> Unit = {},
) : ReaderConnectionLifecycle, NativeReaderEvents {
    enum class State { IDLE, PERMISSION_REQUIRED, DISCOVERING, CONNECTING, READY, RECONNECTING, WAITING_RETRY, STOPPED }

    companion object {
        const val INITIAL_RETRY_MS = 5_000L
        const val MAX_RETRY_MS = 20_000L
        /** Bounds one discovery plus connection; SDK callbacks that never arrive cannot stall retries. */
        const val ATTEMPT_TIMEOUT_MS = 30_000L
        /** A sale bootstrap is bounded by its own deadline; the owner stays out of its way until then. */
        const val SALE_BOOTSTRAP_WAIT_MS = PinnedReaderBootstrap.BOOTSTRAP_TIMEOUT_MS + 5_000L

        private val ownershipLock = Any()
        private var nextToken = 0L
        private var activeOwner: Long? = null

        private fun nextOwnerToken(): Long = synchronized(ownershipLock) { ++nextToken }
        private fun claimOwnership(token: Long) = synchronized(ownershipLock) { activeOwner = token }
        private fun isActiveOwner(token: Long): Boolean = synchronized(ownershipLock) { activeOwner == token }
        private fun releaseOwnership(token: Long): Boolean = synchronized(ownershipLock) {
            (activeOwner == token).also { if (it) activeOwner = null }
        }
        /** A stale success may tear down only a link no newer owner is responsible for. */
        private fun disconnectUnlessForeign(token: Long, disconnect: () -> Unit) {
            val allowed = synchronized(ownershipLock) { activeOwner == null || activeOwner == token }
            if (allowed) disconnect()
        }
    }

    var state = State.IDLE
        private set

    private val ownerToken = nextOwnerToken()
    private var generation = 0L
    private var discovery: NativeCancelable? = null
    private var deadline: NativeCancelable? = null
    private var retry: NativeCancelable? = null
    private var nextRetryMs = INITIAL_RETRY_MS
    private var permissionRequested = false
    private var reportedStatus: ReaderStatus? = null

    @Synchronized
    override fun start() {
        if (state != State.IDLE) return
        claimOwnership(ownerToken)
        terminal.setReaderEvents(this)
        report(ReaderStatus.CONNECTING)
        // A connection created by an older Activity keeps that adapter's SDK listener. Never adopt
        // it: release it, then establish this owner's own connection.
        if (terminal.currentConnectedReader() != null) terminal.disconnect()
        attempt()
    }

    @Synchronized
    override fun onBluetoothPermissionResult(granted: Boolean) {
        if (state != State.PERMISSION_REQUIRED) return
        if (granted && permissions.hasBluetoothPermissions()) attempt() else scheduleRetry()
    }

    @Synchronized
    override fun invalidate() {
        if (state == State.STOPPED) return
        retireAttempt()
        retry?.cancel()
        retry = null
        state = State.STOPPED
        report(ReaderStatus.DISCONNECTED)
        if (releaseOwnership(ownerToken)) terminal.disconnect()
    }

    /**
     * The SDK cancels this discovery when a sale starts its own. Retire it locally and wait until the
     * sale bootstrap has finished, so the owner never competes with it; later retries then adopt the
     * sale's connection through the adapter's reuse branch.
     */
    @Synchronized
    override fun retireDiscovery() {
        if (state != State.DISCOVERING) return
        PliM2Diagnostics.log("owner discovery yielded to sale")
        retireAttempt()
        scheduleRetry(SALE_BOOTSTRAP_WAIT_MS)
    }

    @Synchronized
    override fun onReconnectStarted() {
        if (state != State.READY) return
        PliM2Diagnostics.log("owner sdk reconnect started")
        state = State.RECONNECTING
        report(ReaderStatus.CONNECTING)
    }

    @Synchronized
    override fun onReconnectSucceeded() {
        if (state != State.RECONNECTING) return
        PliM2Diagnostics.log("owner sdk reconnect succeeded")
        state = State.READY
        report(ReaderStatus.CONNECTED)
    }

    /** The SDK follows a failed reconnect with a final disconnect; that disconnect drives the retry. */
    @Synchronized
    override fun onReconnectFailed() {
        if (state == State.RECONNECTING) PliM2Diagnostics.log("owner sdk reconnect failed")
    }

    @Synchronized
    override fun onDisconnected() {
        if (state != State.READY && state != State.RECONNECTING && state != State.CONNECTING) return
        PliM2Diagnostics.log("owner connection lost state=$state")
        retireAttempt()
        scheduleRetry()
    }

    override fun onReaderInputRequested() {
        if (synchronized(this) { state != State.STOPPED }) onReaderInputRequested.invoke()
    }

    private fun attempt() {
        retry = null
        if (!permissions.hasBluetoothPermissions()) {
            state = State.PERMISSION_REQUIRED
            if (permissionRequested) { scheduleRetry(); return }
            permissionRequested = true
            try { permissions.requestBluetoothPermissions() } catch (_: Exception) { scheduleRetry() }
            return
        }
        try {
            terminal.initialize(connectionTokenProvider)
        } catch (_: Exception) {
            scheduleRetry()
            return
        }
        beginDiscovery()
    }

    private fun beginDiscovery() {
        val callbackGeneration = ++generation
        state = State.DISCOVERING
        report(ReaderStatus.CONNECTING)
        deadline = scheduler.schedule(ATTEMPT_TIMEOUT_MS) { onDeadline(callbackGeneration) }
        try {
            val started = terminal.discover(
                BluetoothDiscoveryRequest(NativeCollectionRuntime.DISCOVERY_TIMEOUT_SECONDS, false),
                { readers -> onReaders(callbackGeneration, readers) },
                { onAttemptFailed(callbackGeneration) },
            )
            if (state == State.DISCOVERING && generation == callbackGeneration) discovery = started
            else started.cancel()
        } catch (_: Exception) {
            onAttemptFailed(callbackGeneration)
        }
    }

    @Synchronized
    private fun onReaders(callbackGeneration: Long, readers: List<ConnectedReader>) {
        if (callbackGeneration != generation || state != State.DISCOVERING) return
        // Empty or foreign-only updates are an in-progress scan; the scan timeout bounds them.
        val match = readers.filter(::matchesProvisioning).singleOrNull() ?: return
        discovery?.cancel()
        discovery = null
        state = State.CONNECTING
        try {
            terminal.connect(
                match,
                BluetoothConnectionRequest(locationId, autoReconnectOnUnexpectedDisconnect = true),
                {},
                { onConnected(callbackGeneration, match) },
                { onAttemptFailed(callbackGeneration) },
            )
        } catch (_: Exception) {
            onAttemptFailed(callbackGeneration)
        }
    }

    @Synchronized
    private fun onConnected(callbackGeneration: Long, expected: ConnectedReader) {
        if (callbackGeneration != generation || state != State.CONNECTING) {
            // Noncancellable late success of an abandoned attempt must not leave a stray link.
            disconnectUnlessForeign(ownerToken, terminal::disconnect)
            return
        }
        val current = terminal.currentConnectedReader()
        if (current != expected || !matchesProvisioning(current) || !isActiveOwner(ownerToken)) {
            PliM2Diagnostics.log("owner connect mismatch reject")
            retireAttempt()
            disconnectUnlessForeign(ownerToken, terminal::disconnect)
            scheduleRetry()
            return
        }
        retireAttempt()
        nextRetryMs = INITIAL_RETRY_MS
        state = State.READY
        PliM2Diagnostics.log("owner connected")
        report(ReaderStatus.CONNECTED)
    }

    @Synchronized
    private fun onDeadline(callbackGeneration: Long) {
        if (callbackGeneration != generation || (state != State.DISCOVERING && state != State.CONNECTING)) return
        PliM2Diagnostics.log("owner attempt deadline state=$state")
        retireAttempt()
        scheduleRetry()
    }

    @Synchronized
    private fun onAttemptFailed(callbackGeneration: Long) {
        if (callbackGeneration != generation || (state != State.DISCOVERING && state != State.CONNECTING)) return
        PliM2Diagnostics.log("owner attempt failed state=$state")
        retireAttempt()
        scheduleRetry()
    }

    /** Invalidates every callback of the current attempt; the physical link is untouched. */
    private fun retireAttempt() {
        generation++
        discovery?.cancel()
        discovery = null
        deadline?.cancel()
        deadline = null
    }

    private fun scheduleRetry(delayMs: Long = nextRetryMs.also { nextRetryMs = (it * 2).coerceAtMost(MAX_RETRY_MS) }) {
        if (state == State.STOPPED) return
        state = State.WAITING_RETRY
        report(ReaderStatus.DISCONNECTED)
        retry?.cancel()
        retry = scheduler.schedule(delayMs) { onRetry() }
    }

    @Synchronized
    private fun onRetry() {
        if (state != State.WAITING_RETRY) return
        attempt()
    }

    private fun report(status: ReaderStatus) {
        if (status == reportedStatus) return
        reportedStatus = status
        try { onStatus(status) } catch (_: Exception) { Unit }
    }

    private fun matchesProvisioning(reader: ConnectedReader) =
        locationId == Approved.LOCATION && ReaderPolicy.matchesConfigured(reader, provisionedReaderId)
}
