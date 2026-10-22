package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NativeCollectionBootstrapRuntimeTest {
    private val now = 1_000L
    private val origin = "https://approved.invalid"
    private val session = StaffSession(origin, "association", "cookie", now + 1_000)
    private val ticket = AttemptTicket("ticket", now + 1_000, "tmr_exact", Approved.LOCATION)
    private val reader = ConnectedReader(ticket.readerId, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    @Test fun delegatesPermissionAndUsesRuntimeDiscoveryThenTheExactReaderConnection() {
        val terminal = DeferredTerminal()
        val permissions = Permissions(granted = false)
        val native = runtime(terminal, permissions).also { it.initialize() }
        val adapter = NativeCollectionBootstrapRuntime(native, permissions)
        var operatorNotifications = 0
        val readers = mutableListOf<List<ConnectedReader>>()
        var connected: ConnectedReader? = null
        var failures = 0
        native.setStateListener { operatorNotifications++ }

        assertFalse(adapter.hasBluetoothPermission())
        adapter.requestBluetoothPermission()
        assertEquals(1, permissions.requests)

        permissions.granted = true
        adapter.discover({ readers += it }, { failures++ })
        terminal.publishReaders(listOf(reader))
        adapter.connect(reader, { connected = it }, { failures++ }, { failures++ })

        assertEquals(listOf(listOf(reader)), readers)
        assertEquals(reader, terminal.connectedReader)
        assertEquals(NativeCollectionState.CONNECTING, native.state)
        assertEquals(null, connected)
        terminal.succeedConnection()

        assertEquals(reader, connected)
        assertEquals(NativeCollectionState.CONNECTED, native.state)
        assertTrue(operatorNotifications > 1)
        assertEquals(0, failures)
    }

    @Test fun discoveryAndConnectionFailuresAreTerminalExactlyOnceWithoutReconnect() {
        val discoveryTerminal = DeferredTerminal()
        val discoveryAdapter = NativeCollectionBootstrapRuntime(runtime(discoveryTerminal).also { it.initialize() }, Permissions())
        var discoveryFailures = 0
        discoveryAdapter.discover({}, { discoveryFailures++ })
        discoveryTerminal.failDiscovery()
        discoveryTerminal.failDiscovery()
        assertEquals(1, discoveryFailures)

        val connectionTerminal = DeferredTerminal()
        val connectionAdapter = NativeCollectionBootstrapRuntime(runtime(connectionTerminal).also { it.initialize() }, Permissions())
        var connectionFailures = 0
        connectionAdapter.discover({}, { connectionFailures++ })
        connectionTerminal.publishReaders(listOf(reader))
        connectionAdapter.connect(reader, {}, { connectionFailures++ }, { connectionFailures++ })
        connectionTerminal.failConnection()
        connectionTerminal.disconnectReader()

        assertEquals(1, connectionFailures)
        assertEquals(1, connectionTerminal.connectCalls)

        val disconnectTerminal = DeferredTerminal()
        val disconnectAdapter = NativeCollectionBootstrapRuntime(runtime(disconnectTerminal).also { it.initialize() }, Permissions())
        var disconnects = 0
        disconnectAdapter.discover({}, {})
        disconnectTerminal.publishReaders(listOf(reader))
        disconnectAdapter.connect(reader, {}, { disconnects++ }, {})
        disconnectTerminal.succeedConnection()
        disconnectTerminal.disconnectReader()
        disconnectTerminal.disconnectReader()

        assertEquals(1, disconnects)
        assertEquals(1, disconnectTerminal.connectCalls)
    }

    private fun runtime(terminal: DeferredTerminal, permissions: Permissions = Permissions()) = NativeCollectionRuntime(
        NativeCollectionConfiguration(origin, true),
        session,
        ticket,
        terminal,
        permissions,
        object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" },
        object : PaymentRecovery {
            override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
                RecoveryState.ManualReconciliation
        },
        { now },
    )

    private class Permissions(var granted: Boolean = true) : BluetoothPermissions {
        var requests = 0
        override fun hasBluetoothPermissions() = granted
        override fun requestBluetoothPermissions() { requests++ }
    }

    private class DeferredTerminal : NativeTerminalAdapter {
        private var discoveryUpdate: ((List<ConnectedReader>) -> Unit)? = null
        private var discoveryFailure: (() -> Unit)? = null
        private var disconnected: (() -> Unit)? = null
        private var connected: (() -> Unit)? = null
        private var connectionFailure: (() -> Unit)? = null
        var connectedReader: ConnectedReader? = null
        var connectCalls = 0

        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable {
            discoveryUpdate = onUpdate
            discoveryFailure = onFailure
            return NativeCancelable {}
        }
        override fun connect(
            reader: ConnectedReader,
            request: BluetoothConnectionRequest,
            onDisconnect: () -> Unit,
            onSuccess: () -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            connectedReader = reader
            connectCalls++
            disconnected = onDisconnect
            connected = onSuccess
            connectionFailure = onFailure
            return NativeCancelable {}
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NativeCancelable {}
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NativeCancelable {}
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NativeCancelable {}

        fun publishReaders(readers: List<ConnectedReader>) = requireNotNull(discoveryUpdate).invoke(readers)
        fun failDiscovery() = requireNotNull(discoveryFailure).invoke()
        fun succeedConnection() = requireNotNull(connected).invoke()
        fun failConnection() = requireNotNull(connectionFailure).invoke()
        fun disconnectReader() = requireNotNull(disconnected).invoke()
    }
}
