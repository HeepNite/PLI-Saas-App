package com.pli.kiosk.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class ReaderProvisioningTest {
    private fun tokens() = BoundedConnectionTokens(listOf("pst_one", "pst_two", "pst_three"))

    @Test fun `provisioning connects the exact unregistered M2 and captures its assigned ID`() {
        val terminal = FakeTerminal()
        val controller = ReaderProvisioningController(terminal, GrantedPermissions, tokens())

        controller.initialize()
        controller.discover()
        terminal.publish(listOf(
            ConnectedReader("tmr_wrong", "OTHER", "stripe_m2", ""),
            ConnectedReader("unregistered:${Approved.M2_SERIAL}:stripe_m2", Approved.M2_SERIAL, "stripe_m2", ""),
        ))
        assertTrue(controller.snapshot.readerId!!.startsWith("unregistered:"))
        assertTrue(controller.connect())
        terminal.succeedConnection("tmr_live")

        assertEquals(ReaderProvisioningState.CONNECTED, controller.snapshot.state)
        assertEquals("tmr_live", controller.snapshot.readerId)
        assertEquals(BluetoothConnectionRequest(Approved.LOCATION, false), terminal.connectionRequest)
        assertTrue(terminal.paymentOperations.isEmpty())
    }

    @Test fun `unregistered discovery key accepts only a newly assigned reader ID`() {
        val key = discoveredReaderKey(null, Approved.M2_SERIAL, "stripe_m2")
        assertTrue(key.startsWith("unregistered:"))
        assertTrue(acceptsConnectedReader(key, "tmr_live"))
        assertFalse(acceptsConnectedReader(key, null))
        assertTrue(acceptsConnectedReader("tmr_existing", "tmr_existing"))
        assertFalse(acceptsConnectedReader("tmr_existing", "tmr_other"))
    }

    @Test fun `provisioning and collection build modes cannot coexist`() {
        assertThrows(IllegalArgumentException::class.java) {
            ReaderProvisioningConfiguration(
                "https://pli.example", enabled = true, collectionEnabled = true,
                listOf("pst_one", "pst_two", "pst_three"),
            )
        }
    }

    @Test fun `bounded connection token bundle supports refresh and then exhausts`() {
        val tokens = tokens()
        assertEquals("pst_one", tokens.consume())
        assertEquals("pst_two", tokens.consume())
        assertEquals("pst_three", tokens.consume())
        assertThrows(IllegalArgumentException::class.java) { tokens.consume() }
    }

    @Test fun `ambiguous exact readers fail closed`() {
        val terminal = FakeTerminal()
        val controller = ReaderProvisioningController(terminal, GrantedPermissions, tokens())
        controller.initialize()
        controller.discover()
        terminal.publish(listOf(
            ConnectedReader("unregistered:one", Approved.M2_SERIAL, "stripe_m2", ""),
            ConnectedReader("unregistered:two", Approved.M2_SERIAL, "stripe_m2", ""),
        ))

        assertEquals(ReaderProvisioningState.BLOCKED, controller.snapshot.state)
        assertNull(controller.snapshot.readerId)
        assertFalse(controller.connect())
        assertNull(terminal.connectionRequest)
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

        override fun initialize(connectionTokenProvider: () -> String) {
            assertEquals("pst_one", connectionTokenProvider())
            assertEquals("pst_two", connectionTokenProvider())
        }
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable {
            assertFalse(request.simulated); update = onUpdate; return NativeCancelable {}
        }
        fun publish(readers: List<ConnectedReader>) = requireNotNull(update).invoke(readers)
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            connectionRequest = request; connected = onSuccess; return NonCancellableTerminalOperation
        }
        fun succeedConnection(readerId: String) { observed = readerId; requireNotNull(connected).invoke() }
        override fun observedReaderId() = observed
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = payment("retrieve")
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = payment("collect")
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = payment("confirm")
        private fun payment(name: String): NativeCancelable { paymentOperations += name; return NativeCancelable {} }
    }
}
