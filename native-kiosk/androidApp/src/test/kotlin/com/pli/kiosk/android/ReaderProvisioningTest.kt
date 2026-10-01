package com.pli.kiosk.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class ReaderProvisioningTest {
    private val session = StaffSession("https://pli.example", "association", "cookie", Long.MAX_VALUE)

    @Test fun `provisioning connects only the exact physical M2 without payment operations`() {
        val terminal = FakeTerminal()
        val controller = ReaderProvisioningController(session, terminal, GrantedPermissions, TokenSource)

        controller.initialize()
        controller.discover()
        terminal.publish(listOf(
            ConnectedReader("tmr_wrong", "OTHER", "stripe_m2", ""),
            ConnectedReader("tmr_live", Approved.M2_SERIAL, "stripe_m2", ""),
        ))
        assertEquals("tmr_live", controller.snapshot.readerId)
        assertTrue(controller.connect())
        terminal.succeedConnection()

        assertEquals(ReaderProvisioningState.CONNECTED, controller.snapshot.state)
        assertEquals("tmr_live", controller.snapshot.readerId)
        assertEquals(BluetoothConnectionRequest(Approved.LOCATION, false), terminal.connectionRequest)
        assertTrue(terminal.paymentOperations.isEmpty())
    }

    @Test fun `provisioning and collection build modes cannot coexist`() {
        assertThrows(IllegalArgumentException::class.java) {
            ReaderProvisioningConfiguration("https://pli.example", enabled = true, collectionEnabled = true)
        }
    }

    @Test fun `wrong ambiguous or malformed readers fail closed`() {
        val terminal = FakeTerminal()
        val controller = ReaderProvisioningController(session, terminal, GrantedPermissions, TokenSource)
        controller.initialize()
        controller.discover()
        terminal.publish(listOf(ConnectedReader("bad", Approved.M2_SERIAL, "stripe_m2", "")))

        assertEquals(ReaderProvisioningState.BLOCKED, controller.snapshot.state)
        assertNull(controller.snapshot.readerId)
        assertFalse(controller.connect())
        assertNull(terminal.connectionRequest)
    }

    private object TokenSource : ConnectionTokenSource {
        override fun connectionToken(session: StaffSession) = "pst_live"
    }

    private object GrantedPermissions : BluetoothPermissions {
        override fun hasBluetoothPermissions() = true
        override fun requestBluetoothPermissions() = Unit
    }

    private class FakeTerminal : NativeTerminalAdapter {
        var connectionRequest: BluetoothConnectionRequest? = null
        val paymentOperations = mutableListOf<String>()
        private var update: ((List<ConnectedReader>) -> Unit)? = null
        private var connected: (() -> Unit)? = null
        private var observed: String? = null
        private var selected: ConnectedReader? = null

        override fun initialize(connectionTokenProvider: () -> String) { assertEquals("pst_live", connectionTokenProvider()) }
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable {
            assertFalse(request.simulated); update = onUpdate; return NativeCancelable {}
        }
        fun publish(readers: List<ConnectedReader>) = requireNotNull(update).invoke(readers)
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            selected = reader; connectionRequest = request; connected = onSuccess; return NonCancellableTerminalOperation
        }
        fun succeedConnection() { observed = selected?.id; requireNotNull(connected).invoke() }
        override fun observedReaderId() = observed
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = payment("retrieve")
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = payment("collect")
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = payment("confirm")
        private fun payment(name: String): NativeCancelable { paymentOperations += name; return NativeCancelable {} }
    }
}
