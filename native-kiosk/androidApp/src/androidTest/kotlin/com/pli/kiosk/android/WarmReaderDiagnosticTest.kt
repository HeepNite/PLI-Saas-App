package com.pli.kiosk.android

import android.content.Intent
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.stripe.stripeterminal.Terminal
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WarmReaderDiagnosticTest {
    @Test
    fun reportsOnlyExactWarmReadinessWithoutPaymentOrDurableAttemptMutation() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val store = EncryptedStateStore(context)
        assertNull(store.read().attempt)

        context.startActivity(
            Intent(context, KioskWebActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK,
            ),
        )
        instrumentation.waitForIdleSync()

        val deadline = SystemClock.elapsedRealtime() + 30_000L
        var exact = false
        while (!exact && SystemClock.elapsedRealtime() < deadline) {
            val reader = runCatching {
                if (Terminal.isInitialized()) Terminal.getInstance().connectedReader else null
            }.getOrNull()
            exact = reader?.id == PROVISIONED_READER_ID &&
                reader.serialNumber == Approved.M2_SERIAL &&
                reader.deviceType.toString().lowercase() == "stripe_m2" &&
                reader.location?.id == Approved.LOCATION
            if (!exact) SystemClock.sleep(250L)
        }

        assertNull(store.read().attempt)
        println("W3P27_WARM_READER=${if (exact) "READY" else "NOT_READY"}")
        assertTrue("Exact provisioned M2 did not become warm without payment", exact)
    }

    private companion object {
        const val PROVISIONED_READER_ID = "tmr_GrudQifObHAVgT"
    }
}
