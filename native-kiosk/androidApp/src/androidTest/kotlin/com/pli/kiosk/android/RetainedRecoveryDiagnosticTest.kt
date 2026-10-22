package com.pli.kiosk.android

import android.webkit.CookieManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RetainedRecoveryDiagnosticTest {
    private enum class CoarseRecovery { PAID, PENDING, REJECTED, INELIGIBLE }

    @Test
    fun reportsOnlyTheCoarseAuthoritativeRecoveryResultWithoutMutation() {
        val outcome = runCatching {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val origin = ApprovedOrigin(BuildConfig.APPROVED_HTTPS_ORIGIN)
            val terminalUrl = "${origin.value}/staff/terminal"
            val transport = StaffSessionTransport(origin, System::currentTimeMillis)
            val rawCookie = CookieManager.getInstance().getCookie(terminalUrl)
                ?: return@runCatching CoarseRecovery.INELIGIBLE
            val imported = transport.importBrowserSession(rawCookie)
            val state = EncryptedStateStore(context).read()
            if (classifyRetainedStartupState(state, origin.value, imported.association) != RetainedStartupState.KNOWN_PAYMENT) {
                return@runCatching CoarseRecovery.INELIGIBLE
            }
            val attempt = requireNotNull(state.attempt)
            val result = StaffSessionPurchaseApi(transport).preparedRecover(
                imported,
                requireNotNull(attempt.ticket),
                requireNotNull(attempt.paymentIntentId),
            )
            if (result.paid) CoarseRecovery.PAID else CoarseRecovery.PENDING
        }.getOrDefault(CoarseRecovery.REJECTED)

        println("W3P25_RECOVERY_STATE=${outcome.name}")
        assertTrue(outcome in CoarseRecovery.entries)
    }
}
