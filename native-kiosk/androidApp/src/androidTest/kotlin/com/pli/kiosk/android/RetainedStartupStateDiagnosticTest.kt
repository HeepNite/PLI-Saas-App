package com.pli.kiosk.android

import android.webkit.CookieManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RetainedStartupStateDiagnosticTest {
    @Test
    fun reportsOnlyTheClosedCoarseStateWithoutMutation() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val state = runCatching { EncryptedStateStore(context).read() }.getOrNull()
        val outcome = runCatching {
            val origin = ApprovedOrigin(BuildConfig.APPROVED_HTTPS_ORIGIN)
            val terminalUrl = "${origin.value}/staff/terminal"
            val transport = StaffSessionTransport(origin, System::currentTimeMillis)
            val association = CookieManager.getInstance().getCookie(terminalUrl)?.let { rawCookie ->
                runCatching { transport.importBrowserSession(rawCookie).association }.getOrNull()
            }
            classifyRetainedStartupState(requireNotNull(state), origin.value, association)
        }.getOrDefault(RetainedStartupState.CORRUPT)
        val ticketAge = state?.attempt?.ticket?.let {
            if (it.expiresAt <= System.currentTimeMillis()) "EXPIRED" else "FRESH"
        } ?: "ABSENT"

        println("W3P25_RETAINED_STATE=${outcome.name}")
        println("W3P29_RETAINED_TICKET=$ticketAge")
        assertTrue(outcome in RetainedStartupState.entries)
        assertTrue(ticketAge in setOf("ABSENT", "EXPIRED", "FRESH"))
    }
}
