package com.pli.kiosk.android

import kotlin.test.assertEquals
import org.junit.Test

class StripeDiscoveryTimeoutTest {
    @Test
    fun `bluetooth discovery timeout is mapped to the sdk in seconds`() {
        val configuration = bluetoothDiscoveryConfiguration(
            BluetoothDiscoveryRequest(NativeCollectionRuntime.DISCOVERY_TIMEOUT_SECONDS, false),
        )

        assertEquals(10, NativeCollectionRuntime.DISCOVERY_TIMEOUT_SECONDS)
        assertEquals(10, configuration.timeout)
        assertEquals(false, configuration.isSimulated)
    }
}
