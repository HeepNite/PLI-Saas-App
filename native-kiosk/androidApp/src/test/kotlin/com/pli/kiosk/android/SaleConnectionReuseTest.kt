package com.pli.kiosk.android

import kotlin.test.assertEquals
import org.junit.Test

/** A sale leases the owner's persistent connection; releasing the lease must not tear it down. */
class SaleConnectionReuseTest {
    private val now = 1_000L
    private val reader = ConnectedReader("tmr_fixture", Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)
    private val session = StaffSession("https://approved.invalid", "association", "cookie", now + 120_000)
    private val ticket = AttemptTicket("ticket", now + 120_000, reader.id, Approved.LOCATION)

    @Test
    fun `releasing a reused connection keeps the persistent link`() {
        val terminal = LeaseTerminal(reused = true)
        val runtime = connectedRuntime(terminal)

        runtime.onReaderInvalidated()

        assertEquals(NativeCollectionState.RECONNECT_REQUIRED, runtime.state)
        assertEquals(0, terminal.disconnects)
    }

    @Test
    fun `releasing a connection the sale established itself still disconnects it`() {
        val terminal = LeaseTerminal(reused = false)
        val runtime = connectedRuntime(terminal)

        runtime.onReaderInvalidated()

        assertEquals(1, terminal.disconnects)
    }

    private fun connectedRuntime(terminal: LeaseTerminal): NativeCollectionRuntime {
        val runtime = NativeCollectionRuntime(
            NativeCollectionConfiguration("https://approved.invalid", true), session, ticket, terminal,
            object : BluetoothPermissions {
                override fun hasBluetoothPermissions() = true
                override fun requestBluetoothPermissions() = Unit
            },
            object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" },
            object : PaymentRecovery {
                override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState = error("no payment")
            },
            { now },
        )
        runtime.initialize()
        runtime.discover()
        runtime.selectReader(reader)
        runtime.connectSelectedReader()
        check(runtime.state == NativeCollectionState.CONNECTED)
        return runtime
    }

    private inner class LeaseTerminal(private val reused: Boolean) : NativeTerminalAdapter {
        var disconnects = 0
        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable {
            onUpdate(listOf(reader))
            return NativeCancelable {}
        }
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            onSuccess()
            return if (reused) ReusedTerminalConnection else NonCancellableTerminalOperation
        }
        override fun observedReaderId() = reader.id
        override fun disconnect() { disconnects++ }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NonCancellableTerminalOperation
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NonCancellableTerminalOperation
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NonCancellableTerminalOperation
    }
}
