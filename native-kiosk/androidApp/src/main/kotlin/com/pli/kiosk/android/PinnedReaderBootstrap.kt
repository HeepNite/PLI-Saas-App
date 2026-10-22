package com.pli.kiosk.android

/** Fakeable callbacks for the one prepared-operation reader bootstrap; no SDK or payment API leaks here. */
interface PinnedReaderBootstrapRuntime {
    fun hasBluetoothPermission(): Boolean
    fun requestBluetoothPermission()
    fun discover(onReaders: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit)
    fun connect(
        reader: ConnectedReader,
        onConnected: (ConnectedReader) -> Unit,
        onDisconnected: () -> Unit,
        onFailure: () -> Unit,
    )
}

/**
 * Silently connects one already-admitted prepared operation to its one provisioned M2.
 * Recovery is terminal: a later operation must create a new bootstrap instance.
 */
class PinnedReaderBootstrap(
    private val preparedAttempt: AttemptState,
    private val provisionedReaderId: String,
    private val runtime: PinnedReaderBootstrapRuntime,
    private val clock: () -> Long = System::currentTimeMillis,
    private val onRecoveryRequired: () -> Unit = {},
    private val deadlineScheduler: CollectionDeadlineScheduler = NoopCollectionDeadlineScheduler,
    private val onReady: () -> Unit,
) {
    companion object { const val BOOTSTRAP_TIMEOUT_MS = 40_000L }

    private val ticket = requireNotNull(preparedAttempt.ticket) { "Prepared operation has no ticket" }

    enum class State { IDLE, PERMISSION_REQUIRED, DISCOVERING, CONNECTING, READY, RECOVERY_REQUIRED }

    var state = State.IDLE
        private set
    private var selected: ConnectedReader? = null
    private var acceptedReaders: List<ConnectedReader>? = null
    private var continued = false
    private var deadline: NativeCancelable? = null

    init {
        require(preparedAttempt.mode == AttemptMode.PREPARED) { "Reader bootstrap requires a prepared operation" }
        require(!preparedAttempt.resolved) { "Reader bootstrap requires an unresolved operation" }
        require(ticket.expiresAt > clock()) { "Prepared ticket is expired" }
        require(ticket.readerId == provisionedReaderId) { "Prepared ticket reader does not match provisioning" }
        require(ticket.locationId == Approved.LOCATION) { "Prepared ticket location is not approved" }
    }

    @Synchronized fun start() {
        if (state != State.IDLE) return
        PliM2Diagnostics.log("sale bootstrap start")
        if (!hasCurrentPreparedContext()) {
            recoveryRequired()
            return
        }
        if (!runtime.hasBluetoothPermission()) {
            state = State.PERMISSION_REQUIRED
            try { runtime.requestBluetoothPermission() } catch (_: Exception) { recoveryRequired() }
        } else beginDiscovery()
    }

    /** A grant can resume only the permission-blocked initial discovery, exactly once. */
    @Synchronized fun onBluetoothPermissionResult(granted: Boolean) {
        if (state != State.PERMISSION_REQUIRED) return
        if (granted) beginDiscovery() else recoveryRequired()
    }

    /** Session, ticket expiry, lifecycle, or observed-reader changes are terminal for this operation. */
    @Synchronized fun invalidate() {
        if (state != State.RECOVERY_REQUIRED) recoveryRequired()
    }

    private fun beginDiscovery() {
        if (!hasCurrentPreparedContext()) {
            recoveryRequired()
            return
        }
        state = State.DISCOVERING
        armDeadline()
        try { runtime.discover(::onReaders, ::recoveryRequired) } catch (_: Exception) { recoveryRequired() }
    }

    /** Discovery plus connection is bounded before any PaymentIntent exists; expiry fails closed. */
    private fun armDeadline() {
        if (deadline != null) return
        deadline = try {
            deadlineScheduler.schedule(BOOTSTRAP_TIMEOUT_MS, ::onDeadline)
        } catch (_: Exception) {
            recoveryRequired()
            null
        }
    }

    @Synchronized private fun onDeadline() {
        if (state != State.DISCOVERING && state != State.CONNECTING) return
        PliM2Diagnostics.log("sale bootstrap deadline fired state=$state")
        recoveryRequired()
    }

    private fun cancelDeadline() {
        val pending = deadline ?: return
        deadline = null
        try { pending.cancel() } catch (_: Exception) { Unit }
    }

    @Synchronized private fun onReaders(readers: List<ConnectedReader>) {
        when (state) {
            State.DISCOVERING -> {
                PliM2Diagnostics.log("reader update count=${readers.size}")
                // An empty update is an in-progress scan, not a mismatch; the deadline bounds it.
                if (readers.isEmpty() && hasCurrentPreparedContext()) return
                val matches = readers.filter { ReaderPolicy.matches(it, ticket, provisionedReaderId) }
                if (!hasCurrentPreparedContext() || matches.size != 1) {
                    PliM2Diagnostics.log("reader update rejected matches=${matches.size}")
                    recoveryRequired()
                } else {
                    selected = matches.single()
                    acceptedReaders = readers.toList()
                    state = State.CONNECTING
                    PliM2Diagnostics.log("connect start")
                    try { runtime.connect(selected!!, ::onConnected, ::onDisconnected, ::onConnectFailure) } catch (_: Exception) { onConnectFailure() }
                }
            }
            State.CONNECTING, State.READY -> {
                if (!hasCurrentPreparedContext() || readers != acceptedReaders) recoveryRequired()
            }
            else -> Unit
        }
    }

    @Synchronized private fun onConnected(reader: ConnectedReader) {
        if (state != State.CONNECTING) return
        if (!hasCurrentPreparedContext() || reader != selected || !ReaderPolicy.matches(reader, ticket, provisionedReaderId)) {
            PliM2Diagnostics.log("connect mismatch reject")
            recoveryRequired()
            return
        }
        PliM2Diagnostics.log("connect success")
        cancelDeadline()
        state = State.READY
        if (!continued) {
            if (!hasCurrentPreparedContext()) {
                recoveryRequired()
                return
            }
            continued = true
            try {
                onReady()
            } catch (_: Exception) {
                recoveryRequired()
            }
        }
    }

    private fun hasCurrentPreparedContext(): Boolean =
        preparedAttempt.mode == AttemptMode.PREPARED &&
            !preparedAttempt.resolved &&
            ticket.expiresAt > clock()

    @Synchronized private fun onConnectFailure() {
        if (state == State.CONNECTING) PliM2Diagnostics.log("connect failure category=connect_failed")
        recoveryRequired()
    }

    @Synchronized private fun onDisconnected() {
        if (state == State.CONNECTING || state == State.READY) recoveryRequired()
    }

    @Synchronized private fun recoveryRequired() {
        if (state == State.RECOVERY_REQUIRED) return
        cancelDeadline()
        selected = null
        acceptedReaders = null
        state = State.RECOVERY_REQUIRED
        try { onRecoveryRequired() } catch (_: Exception) { Unit }
    }
}
