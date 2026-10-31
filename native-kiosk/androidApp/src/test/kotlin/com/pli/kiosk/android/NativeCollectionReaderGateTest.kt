package com.pli.kiosk.android

import android.app.Application
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class NativeCollectionReaderGateTest {
    @Test
    fun discoveryUpdatesAsynchronouslyAndAReaderFromAnOlderDiscoveryCannotConnect() {
        val terminal = AsyncTerminal()
        val runtime = runtime(terminal = terminal)
        val current = reader("tmr_current")

        runtime.initialize()
        runtime.discover()
        assertEquals(emptyList(), runtime.discoveredReaders)
        terminal.publish(listOf(current))
        runtime.selectReader(current)
        runtime.discover()

        assertEquals(emptyList(), runtime.discoveredReaders)
        assertFalse(runCatching { runtime.connectSelectedReader() }.isSuccess)
        terminal.publish(listOf(current))
        assertEquals(listOf(current), runtime.discoveredReaders)
        runtime.selectReader(current)
        runtime.connectSelectedReader()
        assertEquals(listOf("tmr_current"), terminal.connects)
    }

    @Test
    fun bluetoothPermissionsCoverLegacyLocationAndModernScanRequirements() {
        assertEquals(
            listOf(android.Manifest.permission.ACCESS_FINE_LOCATION),
            requiredBluetoothPermissions(30).toList(),
        )
        assertEquals(
            listOf(android.Manifest.permission.BLUETOOTH_SCAN, android.Manifest.permission.BLUETOOTH_CONNECT),
            requiredBluetoothPermissions(31).toList(),
        )
    }

    @Test
    fun permissionDenialNeverStartsPhysicalDiscoveryOrConnection() {
        val permissions = ResultPermissions(granted = false)
        val terminal = AsyncTerminal()
        val runtime = runtime(terminal = terminal, permissions = permissions)
        runtime.initialize()

        assertFalse(runCatching { runtime.discover() }.isSuccess)
        assertEquals(1, permissions.requests)
        runtime.onBluetoothPermissionResult(false)

        assertEquals(NativeCollectionState.DISCOVERY_BLOCKED, runtime.state)
        assertEquals(0, terminal.discoveries)
        assertEquals(0, terminal.connects.size)
    }

    private fun runtime(
        terminal: AsyncTerminal = AsyncTerminal(),
        permissions: ResultPermissions = ResultPermissions(),
    ) = NativeCollectionRuntime(
        NativeCollectionConfiguration("https://approved.invalid", true),
        StaffSession("https://approved.invalid", "session", "cookie", 2_000_000),
        AttemptTicket("ticket", 2_000_000, "tmr_current", Approved.LOCATION),
        terminal,
        permissions,
        object : ConnectionTokenSource {
            override fun connectionToken(session: StaffSession): String = "token"
        },
        object : PaymentRecovery {
            override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState =
                RecoveryState.FromServer(PaymentResult(paymentIntentId, "processing", false))
        },
        { 1_000_000 },
    )

    private fun reader(id: String) = ConnectedReader(id, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    private class ResultPermissions(var granted: Boolean = true) : BluetoothPermissions {
        var requests = 0
        override fun hasBluetoothPermissions(): Boolean = granted
        override fun requestBluetoothPermissions() { requests++ }
    }

    private class AsyncTerminal : NativeTerminalAdapter {
        var discoveries = 0
        val connects = mutableListOf<String>()
        private var discoveryUpdate: ((List<ConnectedReader>) -> Unit)? = null

        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun discover(
            request: BluetoothDiscoveryRequest,
            onUpdate: (List<ConnectedReader>) -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            discoveries++
            discoveryUpdate = onUpdate
            return NativeCancelable {}
        }
        fun publish(readers: List<ConnectedReader>) = requireNotNull(discoveryUpdate).invoke(readers)
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            connects += reader.id
            onSuccess()
            return NativeCancelable {}
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable = NativeCancelable {}
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable = NativeCancelable {}
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable = NativeCancelable {}
    }
}
