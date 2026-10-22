package com.pli.kiosk.android

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.Test

class ForegroundWarmReaderTest {
    private val exact = ConnectedReader(PROVISIONED, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    @Test
    fun `foreground start connects only the exact provisioned reader without payment work`() {
        val terminal = RecordingTerminal()
        val owner = owner(terminal)

        owner.start()
        assertEquals(ForegroundWarmReader.State.DISCOVERING, owner.state)
        terminal.publishReaders(exact)
        assertEquals(ForegroundWarmReader.State.CONNECTING, owner.state)
        terminal.completeConnection(exact)

        assertEquals(ForegroundWarmReader.State.READY, owner.state)
        assertEquals(1, terminal.initializations)
        assertEquals(1, terminal.discoveries)
        assertEquals(1, terminal.connections)
        assertTrue(terminal.paymentOperations.isEmpty())
    }

    @Test
    fun `sale retires an in-flight warm discovery locally without disconnecting`() {
        val terminal = RecordingTerminal()
        val owner = owner(terminal)
        owner.start()

        owner.retireDiscovery()
        terminal.publishReaders(exact)

        assertEquals(ForegroundWarmReader.State.INVALIDATED, owner.state)
        assertEquals(1, terminal.discoveryCancels)
        assertEquals(0, terminal.connections)
        assertEquals(0, terminal.disconnects)
    }

    @Test
    fun `sale keeps a ready warm reader available for reuse`() {
        val terminal = RecordingTerminal()
        val owner = owner(terminal)
        owner.start()
        terminal.publishReaders(exact)
        terminal.completeConnection(exact)

        owner.retireDiscovery()

        assertEquals(ForegroundWarmReader.State.READY, owner.state)
        assertEquals(0, terminal.disconnects)
        assertEquals(exact, terminal.current)
    }

    @Test
    fun `repeated start keeps one current sdk connection without duplicate work`() {
        val terminal = RecordingTerminal()
        val owner = owner(terminal)
        owner.start()
        terminal.publishReaders(exact)
        terminal.completeConnection(exact)

        owner.start()

        assertEquals(ForegroundWarmReader.State.READY, owner.state)
        assertEquals(1, terminal.initializations)
        assertEquals(1, terminal.discoveries)
        assertEquals(1, terminal.connections)
        assertTrue(terminal.paymentOperations.isEmpty())
    }

    @Test
    fun `startup never adopts an older sdk connection while missing proof discovers normally`() {
        listOf(
            exact,
            exact.copy(id = "tmr_wrong"),
            exact.copy(serial = "wrong"),
            exact.copy(type = "other"),
            exact.copy(location = "tml_wrong"),
        ).forEach { current ->
            val terminal = RecordingTerminal().apply { this.current = current }
            val owner = owner(terminal)

            owner.start()

            assertEquals(ForegroundWarmReader.State.INVALIDATED, owner.state)
            assertEquals(1, terminal.disconnects)
            assertTrue(terminal.paymentOperations.isEmpty())
        }

        val absent = RecordingTerminal()
        val discovering = owner(absent)
        discovering.start()
        assertEquals(ForegroundWarmReader.State.DISCOVERING, discovering.state)
        assertEquals(1, absent.discoveries)
        assertEquals(0, absent.disconnects)
    }

    @Test
    fun `background poisoning disconnects and late noncancellable success cannot restore readiness`() {
        val terminal = RecordingTerminal()
        val owner = owner(terminal)
        owner.start()
        terminal.publishReaders(exact)

        owner.invalidate()
        terminal.completeConnection(exact)

        assertEquals(ForegroundWarmReader.State.INVALIDATED, owner.state)
        assertEquals(2, terminal.disconnects)
        assertTrue(terminal.paymentOperations.isEmpty())
    }

    @Test
    fun `older late connection callback cannot disconnect a newer ready owner`() {
        val physical = PhysicalConnection()
        val oldTerminal = RecordingTerminal(physical)
        val newTerminal = RecordingTerminal(physical)
        val oldOwner = owner(oldTerminal)
        val newOwner = owner(newTerminal)

        oldOwner.start()
        oldTerminal.publishReaders(exact)
        oldOwner.invalidate()
        newOwner.start()
        newTerminal.publishReaders(exact)
        newTerminal.completeConnection(exact)
        assertEquals(ForegroundWarmReader.State.READY, newOwner.state)

        oldTerminal.completeConnection(exact)

        assertEquals(exact, physical.reader)
        assertEquals(ForegroundWarmReader.State.READY, newOwner.state)
        assertEquals(1, oldTerminal.disconnects)
    }

    @Test
    fun `older late success cannot disconnect newer connecting owner`() {
        val physical = PhysicalConnection()
        val oldTerminal = RecordingTerminal(physical)
        val newTerminal = RecordingTerminal(physical)
        val oldOwner = owner(oldTerminal)
        val newOwner = owner(newTerminal)

        oldOwner.start()
        oldTerminal.publishReaders(exact)
        oldOwner.invalidate()

        newOwner.start()
        newTerminal.publishReaders(exact)
        assertEquals(ForegroundWarmReader.State.CONNECTING, newOwner.state)

        oldTerminal.completeConnection(exact)

        assertEquals(ForegroundWarmReader.State.CONNECTING, newOwner.state)
        assertEquals(0, newTerminal.disconnects)
    }

    @Test
    fun `sdk connected reader reuse requires every provisioned physical field`() {
        assertTrue(reusableWarmReader(exact, PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(null, PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(id = "tmr_wrong"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(serial = "wrong"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(type = "other"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(location = "tml_wrong"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact, null, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact, PROVISIONED, null))
    }

    @Test
    fun `permission loss after ready poisons and disconnects the warm owner`() {
        val permissions = RecordingPermissions(granted = true)
        val terminal = RecordingTerminal()
        val owner = owner(terminal, permissions)
        owner.start()
        terminal.publishReaders(exact)
        terminal.completeConnection(exact)
        assertEquals(ForegroundWarmReader.State.READY, owner.state)

        permissions.granted = false
        owner.onBluetoothPermissionResult(false)

        assertEquals(ForegroundWarmReader.State.INVALIDATED, owner.state)
        assertEquals(1, terminal.disconnects)
    }

    @Test
    fun `permission grant resumes warm discovery once and denial poisons`() {
        val permissions = RecordingPermissions(granted = false)
        val terminal = RecordingTerminal()
        val owner = owner(terminal, permissions)

        owner.start()
        assertEquals(ForegroundWarmReader.State.PERMISSION_REQUIRED, owner.state)
        assertEquals(1, permissions.requests)
        assertEquals(0, terminal.discoveries)

        permissions.granted = true
        owner.onBluetoothPermissionResult(true)
        owner.onBluetoothPermissionResult(true)
        assertEquals(ForegroundWarmReader.State.DISCOVERING, owner.state)
        assertEquals(1, terminal.discoveries)

        val deniedTerminal = RecordingTerminal()
        val denied = owner(deniedTerminal, RecordingPermissions(granted = false))
        denied.start()
        denied.onBluetoothPermissionResult(false)
        assertEquals(ForegroundWarmReader.State.INVALIDATED, denied.state)
        assertEquals(1, deniedTerminal.disconnects)
    }

    private fun owner(
        terminal: RecordingTerminal,
        permissions: RecordingPermissions = RecordingPermissions(granted = true),
    ) = ForegroundWarmReader(
        terminal = terminal,
        permissions = permissions,
        connectionTokenProvider = { "connection-token" },
        provisionedReaderId = PROVISIONED,
        locationId = Approved.LOCATION,
    )

    private class RecordingPermissions(var granted: Boolean) : BluetoothPermissions {
        var requests = 0
        override fun hasBluetoothPermissions() = granted
        override fun requestBluetoothPermissions() { requests++ }
    }

    private class PhysicalConnection(var reader: ConnectedReader? = null)

    private class RecordingTerminal(
        private val physical: PhysicalConnection = PhysicalConnection(),
    ) : NativeTerminalAdapter {
        var initializations = 0
        var discoveries = 0
        var connections = 0
        var disconnects = 0
        var discoveryCancels = 0
        var current: ConnectedReader?
            get() = physical.reader
            set(value) { physical.reader = value }
        val paymentOperations = mutableListOf<String>()
        private var discoveryUpdate: ((List<ConnectedReader>) -> Unit)? = null
        private var connected: (() -> Unit)? = null
        private var expected: ConnectedReader? = null

        override fun initialize(connectionTokenProvider: () -> String) { initializations++ }
        override fun discover(
            request: BluetoothDiscoveryRequest,
            onUpdate: (List<ConnectedReader>) -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            discoveries++
            discoveryUpdate = onUpdate
            return NativeCancelable { discoveryCancels++; discoveryUpdate = null }
        }
        override fun connect(
            reader: ConnectedReader,
            request: BluetoothConnectionRequest,
            onDisconnect: () -> Unit,
            onSuccess: () -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            connections++
            expected = reader
            connected = onSuccess
            return NonCancellableTerminalOperation
        }
        override fun currentConnectedReader(): ConnectedReader? = current
        override fun disconnect() { disconnects++; current = null }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            paymentOperations += "retrieve"
            return NonCancellableTerminalOperation
        }
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            paymentOperations += "collect"
            return NonCancellableTerminalOperation
        }
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            paymentOperations += "confirm"
            return NonCancellableTerminalOperation
        }

        fun publishReaders(vararg readers: ConnectedReader) = discoveryUpdate?.invoke(readers.toList())
        fun completeConnection(reader: ConnectedReader) {
            current = reader
            check(reader == expected)
            connected?.invoke()
        }
    }

    private companion object { const val PROVISIONED = "tmr_exact" }
}
