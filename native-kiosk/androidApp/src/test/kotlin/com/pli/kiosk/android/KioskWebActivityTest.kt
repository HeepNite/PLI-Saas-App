package com.pli.kiosk.android

import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
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
    fun kioskWindowKeepsTheScreenOnSoTheReaderConnectionIsNeverReleasedBySleep() {
        val keepScreenOn = android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        assertEquals(keepScreenOn, KioskWebActivity.KIOSK_WINDOW_FLAGS and keepScreenOn)
    }

    @Test
    fun onlyExactTopLevelTerminalCompletionIsACookieCaptureOpportunity() {
        val admission = requireNotNull(SecureWebAdmission.from(origin))

        assertTrue(KioskWebActivity.isExactTerminalCompletion(admission, terminal, terminal))
        assertFalse(KioskWebActivity.isExactTerminalCompletion(admission, "$terminal?next=1", terminal))
        assertFalse(KioskWebActivity.isExactTerminalCompletion(admission, terminal, "$terminal#fragment"))
    }

    @Test
    fun stoppedActivityRequestsExactlyOneReplacementWhileInitialAndRepeatedResumesDoNot() {
        val originalHost = attachedFixture()
        val original = KioskWebActivityRecreation()

        assertFalse(original.onResume())
        originalHost.controller.onApplicationBackgrounded()
        original.onStop()
        assertTrue(original.onResume())
        assertFalse(original.onResume())

        val replacement = KioskWebActivityRecreation()
        val replacementHost = Fixture()
        assertFalse(replacement.onResume())
        assertEquals(KioskWebPageResult.RELOAD_REQUIRED, replacementHost.controller.onPageFinished(terminal, terminal))
        assertEquals(KioskWebPageResult.BRIDGE_ACTIVE, replacementHost.controller.onPageFinished(terminal, terminal))
        assertEquals(1, replacementHost.contextCreations)
    }

    @Test
    fun paidRecoveryRequestsExactlyOneImmediateActivityReplacement() {
        val recovery = KioskWebActivityRecreation()

        assertTrue(recovery.onRetainedRecoveryReady(canRecreate = true))
        assertFalse(recovery.onRetainedRecoveryReady(canRecreate = true))
        recovery.onStop()
        assertFalse(recovery.onResume())
    }

    @Test
    fun paidRecoveryCannotReviveAnUnavailableActivity() {
        val recovery = KioskWebActivityRecreation()

        assertFalse(recovery.onRetainedRecoveryReady(canRecreate = false))
        assertFalse(recovery.onRetainedRecoveryReady(canRecreate = true))
    }

    @Test
    fun retainedRecoveryOwnerClaimResolvesOnTheOwnerThreadNotWhenQueued() {
        val queued = ArrayBlockingQueue<Runnable>(1)
        var ownerAvailable = true
        var accepted: Boolean? = null
        val waiter = thread(start = true) {
            accepted = RetainedRecoveryOwnerClaim({ queued.add(it) }, 1_000L).await {
                ownerAvailable
            }
        }

        val claim = queued.poll(1, TimeUnit.SECONDS)
        ownerAvailable = false
        requireNotNull(claim).run()
        waiter.join(1_000L)

        assertFalse(waiter.isAlive)
        assertEquals(false, accepted)
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
        assertEquals(KioskWebPageResult.IGNORED, fixture.controller.onPageFinished("$terminal?next=1", terminal))
        assertEquals(0, fixture.captures)
        assertEquals(0, fixture.contextCreations)

        assertEquals(KioskWebPageResult.IGNORED, fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(1, fixture.captures)
        assertEquals(0, fixture.contextCreations)

        captureSucceeds = true
        current = null
        assertEquals(KioskWebPageResult.IGNORED, fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(2, fixture.captures)
        assertEquals(0, fixture.contextCreations)

        current = session
        assertEquals(KioskWebPageResult.RELOAD_REQUIRED, fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(1, fixture.contextCreations)
        assertEquals(1, fixture.host.attachments)
        assertEquals(KioskWebPageResult.BRIDGE_ACTIVE, fixture.controller.onPageFinished(terminal, terminal))
        fixture.controller.onResume()
        assertEquals(1, fixture.contextCreations)
    }

    @Test
    fun declinedContextOrHostAttachmentFailsClosedAndPoisonsCreatedContext() {
        val declined = Fixture(contextAvailable = false)
        assertEquals(KioskWebPageResult.REJECTED, declined.controller.onPageFinished(terminal, terminal))
        assertEquals(1, declined.contextCreations)
        assertTrue(declined.events.isEmpty())

        val failedAttach = Fixture(hostAttaches = false)
        assertEquals(KioskWebPageResult.REJECTED, failedAttach.controller.onPageFinished(terminal, terminal))
        assertEquals(listOf("host.attach", "host.invalidate", "context.invalidate"), failedAttach.events)
        assertEquals(KioskWebPageResult.REJECTED, failedAttach.controller.onPageFinished(terminal, terminal))
        assertEquals(1, failedAttach.contextCreations)
    }

    @Test
    fun throwingHostAttachmentFailsClosedAndCleansBothOwners() {
        val fixture = Fixture(hostThrows = true)

        assertEquals(KioskWebPageResult.REJECTED, fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(listOf("host.attach", "host.invalidate", "context.invalidate"), fixture.events)
        assertEquals(KioskWebPageResult.REJECTED, fixture.controller.onPageFinished(terminal, terminal))
    }

    @Test
    fun reloadIsSingleUseAndExactActiveCompletionsAreIdempotent() {
        val awaitingReload = Fixture()
        assertEquals(KioskWebPageResult.RELOAD_REQUIRED, awaitingReload.controller.onPageFinished(terminal, terminal))
        assertFalse(awaitingReload.controller.onNavigation(terminal, false, true))
        awaitingReload.events.clear()
        assertEquals(KioskWebPageResult.REJECTED, awaitingReload.controller.onPageFinished("$terminal?next=1", terminal))
        assertEquals(listOf("host.invalidate", "context.session"), awaitingReload.events)

        val active = Fixture()
        assertEquals(KioskWebPageResult.RELOAD_REQUIRED, active.controller.onPageFinished(terminal, terminal))
        assertEquals(KioskWebPageResult.BRIDGE_ACTIVE, active.controller.onPageFinished(terminal, terminal))
        assertEquals(KioskWebPageResult.BRIDGE_ACTIVE, active.controller.onPageFinished(terminal, terminal))
        assertEquals(2, active.captures)
        assertTrue(active.events.contains("host.attach"))

        active.events.clear()
        assertEquals(KioskWebPageResult.REJECTED, active.controller.onPageFinished("$terminal?next=1", terminal))
        assertEquals(listOf("host.invalidate", "context.session"), active.events)
    }

    @Test
    fun reloadAcceptsTheSameSessionAuthorityWithARefreshedExpiry() {
        var current: StaffSession? = session
        val fixture = Fixture(currentSession = { current })

        assertEquals(KioskWebPageResult.RELOAD_REQUIRED, fixture.controller.onPageFinished(terminal, terminal))
        current = session.copy(expiresAt = Long.MAX_VALUE - 1)

        assertEquals(KioskWebPageResult.BRIDGE_ACTIVE, fixture.controller.onPageFinished(terminal, terminal))
        assertEquals(listOf("host.attach"), fixture.events)
    }

    @Test
    fun reloadRequiresTheCapturedSessionAuthorityToStillOwnTheContext() =
        listOf<StaffSession?>(
            null,
            session.copy(origin = "https://changed.invalid"),
            session.copy(association = "changed"),
            session.copy(cookie = "changed"),
        ).forEach { reloadedSession ->
            var current: StaffSession? = session
            val fixture = Fixture(currentSession = { current })
            assertEquals(KioskWebPageResult.RELOAD_REQUIRED, fixture.controller.onPageFinished(terminal, terminal))
            current = reloadedSession
            assertEquals(KioskWebPageResult.REJECTED, fixture.controller.onPageFinished(terminal, terminal))
            assertEquals(listOf("host.attach", "host.invalidate", "context.session"), fixture.events)
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
        assertEquals(KioskWebPageResult.RELOAD_REQUIRED, it.controller.onPageFinished(terminal, terminal))
        assertEquals(KioskWebPageResult.BRIDGE_ACTIVE, it.controller.onPageFinished(terminal, terminal))
        it.events.clear()
    }

    private fun assertInvalidates(event: String, action: KioskWebHostLifecycle.() -> Unit) {
        val fixture = attachedFixture()
        fixture.controller.action()
        assertEquals(listOf("host.invalidate", event), fixture.events)
        assertEquals(KioskWebPageResult.REJECTED, fixture.controller.onPageFinished(terminal, terminal))
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
