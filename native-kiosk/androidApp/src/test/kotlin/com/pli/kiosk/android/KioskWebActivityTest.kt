package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class KioskWebActivityTest {
    private val origin = "https://approved.invalid"
    private val terminal = "$origin/staff/terminal"
    private val admission = requireNotNull(SecureWebAdmission.from(origin))
    private val session = StaffSession(origin, "association", "cookie", Long.MAX_VALUE)

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

    @Test
    fun hostAttachmentNeedsExactCompletionSuccessfulCaptureAndFreshSession() {
        var captureSucceeds = false
        var current: StaffSession? = session
        val fixture = Fixture({ captureSucceeds }, { current })

        fixture.controller.onResume()
        assertFalse(fixture.controller.onPageFinished("$terminal?next=1", terminal))
        assertEquals(0, fixture.captures)
        assertEquals(0, fixture.contextCreations)

        assertFalse(fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(1, fixture.captures)
        assertEquals(0, fixture.contextCreations)

        captureSucceeds = true
        current = null
        assertFalse(fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(2, fixture.captures)
        assertEquals(0, fixture.contextCreations)

        current = session
        assertTrue(fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(1, fixture.contextCreations)
        assertEquals(1, fixture.host.attachments)
        fixture.controller.onResume()
        assertEquals(1, fixture.contextCreations)
    }

    @Test
    fun declinedContextOrHostAttachmentFailsClosedAndPoisonsCreatedContext() {
        val declined = Fixture(contextAvailable = false)
        assertFalse(declined.controller.onPageFinished(terminal, terminal))
        assertEquals(1, declined.contextCreations)
        assertTrue(declined.events.isEmpty())

        val failedAttach = Fixture(hostAttaches = false)
        assertFalse(failedAttach.controller.onPageFinished(terminal, terminal))
        assertEquals(listOf("host.attach", "context.invalidate"), failedAttach.events)
        assertFalse(failedAttach.controller.onPageFinished(terminal, terminal))
        assertEquals(1, failedAttach.contextCreations)
    }

    @Test
    fun throwingHostAttachmentFailsClosedAndCleansBothOwners() {
        val fixture = Fixture(hostThrows = true)

        assertFalse(fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(listOf("host.attach", "host.invalidate", "context.invalidate"), fixture.events)
        assertFalse(fixture.controller.onPageFinished(terminal, terminal))
    }

    @Test
    fun invalidationRemovesHostBeforeItsOwnedLifecycleEventAndCannotReviveIt() {
        val subframe = attachedFixture()
        assertFalse(subframe.controller.onNavigation("https://foreign.invalid", false, false))
        assertTrue(subframe.events.isEmpty())

        assertInvalidates("context.session") { onNavigation("https://foreign.invalid", false, true) }
        assertInvalidates("context.session") { onNavigation(terminal, true, true) }
        assertInvalidates("context.session") { onNavigation(terminal, false, true) }
        assertInvalidates("context.background") { onApplicationBackgrounded() }
        assertInvalidates("context.session") { onSessionInvalidated() }
        assertInvalidates("context.reader") { onReaderInvalidated() }
        assertInvalidates("context.invalidate") { onDestroy() }
    }

    @Test
    fun bluetoothResultsReachOnlyTheCurrentContextAndDenialIsFalse() {
        val fixture = attachedFixture()

        fixture.controller.onPermissionResult(BluetoothPermissionRequest.CODE + 1, true)
        assertTrue(fixture.events.isEmpty())
        fixture.controller.onPermissionResult(BluetoothPermissionRequest.CODE, false)
        assertEquals(listOf("context.permission:false"), fixture.events)

        fixture.events.clear()
        fixture.controller.onSessionInvalidated()
        fixture.events.clear()
        fixture.controller.onPermissionResult(BluetoothPermissionRequest.CODE, true)
        assertTrue(fixture.events.isEmpty())
    }

    private fun attachedFixture() = Fixture().also {
        assertTrue(it.controller.onPageFinished(terminal, terminal))
        it.events.clear()
    }

    private fun assertInvalidates(event: String, action: KioskWebHostLifecycle.() -> Unit) {
        val fixture = attachedFixture()
        fixture.controller.action()
        assertEquals(listOf("host.invalidate", event), fixture.events)
        assertFalse(fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(1, fixture.contextCreations)
    }

    private inner class Fixture(
        private val captureSucceeds: () -> Boolean = { true },
        private val currentSession: () -> StaffSession? = { session },
        private val contextAvailable: Boolean = true,
        hostAttaches: Boolean = true,
        hostThrows: Boolean = false,
    ) {
        val events = mutableListOf<String>()
        val context = RecordingContext(events)
        val host = RecordingHost(events, hostAttaches, hostThrows)
        var captures = 0
        var contextCreations = 0
        val controller = KioskWebHostLifecycle(
            admission,
            { _, _ -> captures++; captureSucceeds() },
            currentSession,
            { contextCreations++; context.takeIf { contextAvailable } },
            { host },
        )
    }

    private class RecordingHost(
        private val events: MutableList<String>, private val attaches: Boolean, private val throws: Boolean,
    ) : KioskWebHost {
        var attachments = 0
        override fun attach(): Boolean {
            events += "host.attach"
            attachments++
            if (throws) error("fixture attach failure")
            return attaches
        }
        override fun invalidate() { events += "host.invalidate" }
    }

    private class RecordingContext(private val events: MutableList<String>) : KioskWebHostContext {
        override fun onBluetoothPermissionResult(granted: Boolean) { events += "context.permission:$granted" }
        override fun onApplicationBackgrounded() { events += "context.background" }
        override fun onSessionInvalidated() { events += "context.session" }
        override fun onReaderInvalidated() { events += "context.reader" }
        override fun invalidate() { events += "context.invalidate" }
    }
}
