package com.pli.kiosk.android

/**
 * Adapts one initialized collection runtime to the pinned-reader bootstrap without creating a
 * second Terminal path. Host lifecycle wiring remains the responsibility of a later composition.
 */
class NativeCollectionBootstrapRuntime(
    private val collection: NativeCollectionRuntime,
    private val permissions: BluetoothPermissions,
) : PinnedReaderBootstrapRuntime {
    override fun hasBluetoothPermission() = permissions.hasBluetoothPermissions()

    override fun requestBluetoothPermission() = permissions.requestBluetoothPermissions()

    override fun discover(onReaders: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit) {
        val operation = DiscoveryOperation(onFailure)
        var started = false
        val callback: (List<ConnectedReader>) -> Unit = { readers ->
            if (started && !operation.failed) {
                if (readers.isNotEmpty()) operation.stopObserving()
                onReaders(readers)
            }
        }
        try {
            collection.setDiscoveryListener(callback)
            operation.subscription = collection.observeState {
                if (started && collection.state in setOf(
                        NativeCollectionState.DISCOVERY_BLOCKED,
                        NativeCollectionState.RECONNECT_REQUIRED,
                        NativeCollectionState.SESSION_READY,
                    )
                ) operation.fail()
            }
            started = true
            collection.discover()
        } catch (_: Exception) {
            operation.fail()
        }
    }

    override fun connect(
        reader: ConnectedReader,
        onConnected: (ConnectedReader) -> Unit,
        onDisconnected: () -> Unit,
        onFailure: () -> Unit,
    ) {
        val operation = ConnectionOperation(onConnected, onDisconnected, onFailure, reader)
        var started = false
        try {
            collection.setDiscoveryListener {}
            operation.subscription = collection.observeState {
                if (!started) return@observeState
                when (collection.state) {
                    NativeCollectionState.CONNECTED -> operation.connected()
                    NativeCollectionState.RECONNECT_REQUIRED,
                    NativeCollectionState.DISCOVERY_BLOCKED -> operation.disconnectedOrFailed()
                    else -> Unit
                }
            }
            started = true
            collection.selectReader(reader)
            collection.connectSelectedReader()
        } catch (_: Exception) {
            operation.fail()
        }
    }

    private class DiscoveryOperation(private val onFailure: () -> Unit) {
        var subscription: NativeStateSubscription? = null
        var failed = false

        fun stopObserving() = subscription?.unsubscribe()
        fun fail() {
            if (failed) return
            failed = true
            stopObserving()
            onFailure()
        }
    }

    private class ConnectionOperation(
        private val onConnected: (ConnectedReader) -> Unit,
        private val onDisconnected: () -> Unit,
        private val onFailure: () -> Unit,
        private val reader: ConnectedReader,
    ) {
        var subscription: NativeStateSubscription? = null
        private var connected = false
        private var terminal = false

        fun connected() {
            if (terminal || connected) return
            connected = true
            onConnected(reader)
        }

        fun disconnectedOrFailed() {
            if (terminal) return
            terminal = true
            subscription?.unsubscribe()
            if (connected) onDisconnected() else onFailure()
        }

        fun fail() = disconnectedOrFailed()
    }
}
