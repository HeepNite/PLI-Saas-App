package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class KioskWebActivityTest {
    private val origin = "https://approved.invalid"
    private val terminal = "$origin/staff/terminal"

    @Test
    fun onlyExactTopLevelTerminalCompletionIsACookieCaptureOpportunity() {
        val admission = requireNotNull(SecureWebAdmission.from(origin))

        assertTrue(KioskWebActivity.isExactTerminalCompletion(admission, terminal, terminal))
        assertFalse(KioskWebActivity.isExactTerminalCompletion(admission, "$terminal?next=1", terminal))
        assertFalse(KioskWebActivity.isExactTerminalCompletion(admission, terminal, "$terminal#fragment"))
    }

    @Test
    fun collectionFlagAloneCannotExposeABridge() {
        assertFalse(SecureWebMessageHost.canAttach(SecureWebAdmission.from(origin), true, true, null))
    }
}
