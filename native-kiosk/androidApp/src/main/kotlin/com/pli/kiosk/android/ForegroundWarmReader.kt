package com.pli.kiosk.android

interface WarmReaderLifecycle {
    fun start()
    fun onBluetoothPermissionResult(granted: Boolean)
    fun invalidate()
    /** A sale's own discovery supersedes in-flight warm discovery; a READY reader stays reusable. */
    fun retireDiscovery() = Unit
}

/**
 * Owns BLE transport for one foreground kiosk Activity. This class cannot create or mutate payment
 * state: every payment remains owned by a later signed prepared operation.
 */
class ForegroundWarmReader(
    private val terminal: NativeTerminalAdapter,
    private val permissions: BluetoothPermissions,
    private val connectionTokenProvider: () -> String,
    private val provisionedReaderId: String,
    private val locationId: String,
) : WarmReaderLifecycle {
    enum class State { IDLE, PERMISSION_REQUIRED, DISCOVERING, CONNECTING, READY, INVALIDATED }

    var state = State.IDLE
        private set

    private val ownerToken = nextOwnerToken()
    private var initialized = false
    private var generation = 0L
    private var discovery: NativeCancelable? = null
    private var selected: ConnectedReader? = null

    @Synchronized
    override fun start() {
        if (state != State.IDLE) return
        claimOwnership(ownerToken)
        if (!initialized) {
            try {
                terminal.initialize(connectionTokenProvider)
                initialized = true
            } catch (_: Exception) {
                invalidate()
                return
            }
        }
        // A connection created by an older Activity retains that adapter's disconnect listener.
        // Never adopt it: only this owner's own connect callback may establish warm readiness.
        if (terminal.currentConnectedReader() != null) {
            invalidate()
            return
        }
        if (!permissions.hasBluetoothPermissions()) {
            state = State.PERMISSION_REQUIRED
            try {
                permissions.requestBluetoothPermissions()
            } catch (_: Exception) {
                invalidate()
            }
            return
        }
        beginDiscovery()
    }

    @Synchronized
    override fun onBluetoothPermissionResult(granted: Boolean) {
        if (!granted) {
            if (state != State.IDLE && state != State.INVALIDATED) invalidate()
            return
        }
        if (state != State.PERMISSION_REQUIRED) return
        if (!permissions.hasBluetoothPermissions()) invalidate() else beginDiscovery()
    }

    @Synchronized
    override fun invalidate() {
        if (state == State.INVALIDATED) return
        retireLocally()
        if (releaseOwnership(ownerToken)) terminal.disconnect()
    }

    /**
     * The SDK cancels this discovery when the sale starts its own and the stale callbacks are then
     * generation-gated, which would leave this owner DISCOVERING forever. Retire it locally only.
     */
    @Synchronized
    override fun retireDiscovery() {
        if (state != State.DISCOVERING) return
        PliM2Diagnostics.log("warm discovery retired")
        retireLocally()
    }

    private fun beginDiscovery() {
        val callbackGeneration = ++generation
        state = State.DISCOVERING
        try {
            val started = terminal.discover(
                BluetoothDiscoveryRequest(NativeCollectionRuntime.DISCOVERY_TIMEOUT_SECONDS, false),
                { readers -> onReaders(callbackGeneration, readers) },
                { onFailure(callbackGeneration) },
            )
            if (state == State.DISCOVERING && generation == callbackGeneration) discovery = started
            else started.cancel()
        } catch (_: Exception) {
            onFailure(callbackGeneration)
        }
    }

    @Synchronized
    private fun onReaders(callbackGeneration: Long, readers: List<ConnectedReader>) {
        if (callbackGeneration != generation || state != State.DISCOVERING) return
        val matches = readers.filter(::matchesProvisioning)
        if (matches.size != 1) {
            invalidate()
            return
        }
        discovery?.cancel()
        discovery = null
        selected = matches.single()
        state = State.CONNECTING
        val expected = selected!!
        try {
            terminal.connect(
                expected,
                BluetoothConnectionRequest(locationId, false),
                { onDisconnected(callbackGeneration) },
                { onConnected(callbackGeneration, expected) },
                { onFailure(callbackGeneration) },
            )
        } catch (_: Exception) {
            onFailure(callbackGeneration)
        }
    }

    @Synchronized
    private fun onConnected(callbackGeneration: Long, expected: ConnectedReader) {
        if (callbackGeneration != generation || state != State.CONNECTING) {
            if (isActiveOwner(ownerToken)) invalidate()
            else {
                retireLocally()
                handleForeignStaleSuccess(ownerToken, terminal::disconnect)
            }
            return
        }
        val current = terminal.currentConnectedReader()
        if (current != expected || !matchesProvisioning(current)) {
            invalidate()
            return
        }
        if (markOwnerReady(ownerToken)) state = State.READY
        else {
            retireLocally()
            handleForeignStaleSuccess(ownerToken, terminal::disconnect)
        }
    }

    @Synchronized
    private fun onDisconnected(callbackGeneration: Long) {
        if (callbackGeneration == generation) invalidate()
    }

    @Synchronized
    private fun onFailure(callbackGeneration: Long) {
        if (callbackGeneration == generation) invalidate()
    }

    private fun retireLocally() {
        generation++
        discovery?.cancel()
        discovery = null
        selected = null
        state = State.INVALIDATED
    }

    private fun matchesProvisioning(reader: ConnectedReader) =
        locationId == Approved.LOCATION && ReaderPolicy.matchesConfigured(reader, provisionedReaderId)

    private companion object {
        private data class ActiveOwner(val token: Long)

        private val ownershipLock = Any()
        private var nextToken = 0L
        private var activeOwner: ActiveOwner? = null

        fun nextOwnerToken(): Long = synchronized(ownershipLock) { ++nextToken }

        fun claimOwnership(token: Long) = synchronized(ownershipLock) {
            activeOwner = ActiveOwner(token)
        }

        fun isActiveOwner(token: Long): Boolean = synchronized(ownershipLock) {
            activeOwner?.token == token
        }

        fun markOwnerReady(token: Long): Boolean = synchronized(ownershipLock) {
            activeOwner?.token == token
        }

        fun releaseOwnership(token: Long): Boolean = synchronized(ownershipLock) {
            if (activeOwner?.token != token) false
            else {
                activeOwner = null
                true
            }
        }

        fun handleForeignStaleSuccess(token: Long, disconnectWithoutOwner: () -> Unit) {
            val action = synchronized(ownershipLock) {
                val current = activeOwner
                when {
                    current == null -> disconnectWithoutOwner
                    current.token == token -> disconnectWithoutOwner
                    else -> null
                }
            }
            action?.invoke()
        }
    }
}
