package com.pli.kiosk.android

import android.Manifest
import android.app.Application
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class StripeTerminalDiscoveryPermissionTest {
    private val request = BluetoothDiscoveryRequest(NativeCollectionRuntime.DISCOVERY_TIMEOUT_SECONDS, false)

    @Test
    fun `missing Bluetooth permission fails closed without starting Terminal discovery`() {
        val adapter = StripeTerminalSdkAdapter(RuntimeEnvironment.getApplication())
        var updates = 0
        var failures = 0

        // Terminal is never initialized here: any SDK discovery call would throw instead of failing closed.
        val cancelable = adapter.discover(request, { updates++ }, { failures++ })
        cancelable.cancel()

        assertEquals(0, updates)
        assertEquals(1, failures)
    }

    @Test
    fun `partial Bluetooth grant still fails closed without starting Terminal discovery`() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application).grantPermissions(Manifest.permission.BLUETOOTH_SCAN)
        var failures = 0

        StripeTerminalSdkAdapter(application).discover(request, {}, { failures++ })

        assertEquals(1, failures)
    }

    @Test
    fun `discovery permission requires every runtime permission for the platform level`() {
        val modern = setOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        assertTrue(bluetoothDiscoveryPermitted(35) { it in modern })
        assertFalse(bluetoothDiscoveryPermitted(35) { it == Manifest.permission.BLUETOOTH_SCAN })
        assertFalse(bluetoothDiscoveryPermitted(35) { it == Manifest.permission.ACCESS_FINE_LOCATION })
        assertTrue(bluetoothDiscoveryPermitted(30) { it == Manifest.permission.ACCESS_FINE_LOCATION })
        assertFalse(bluetoothDiscoveryPermitted(30) { false })
    }
}
