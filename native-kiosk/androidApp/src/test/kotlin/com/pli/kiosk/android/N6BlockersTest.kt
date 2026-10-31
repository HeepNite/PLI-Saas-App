package com.pli.kiosk.android

import android.content.Intent
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class N6BlockersTest {
    private val now = 1_000_000L
    private val origin = "https://approved.invalid"
    private val session = StaffSession(origin, "session", "cookie", now + 200_000)
    private val ticket = AttemptTicket("ticket", now + 100_000, "tmr_fixture", Approved.LOCATION)
    private val reader = ConnectedReader(ticket.readerId, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    @Test fun kioskWebActivityIsTheDefaultLauncher() {
        val context = RuntimeEnvironment.getApplication()
        val launchIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(context.packageName)
        assertTrue(context.packageManager.queryIntentActivities(launchIntent, 0).any { it.activityInfo.name == KioskWebActivity::class.java.name })
    }

    @Test fun discoverySelectionAndConnectionHaveSeparateExactGatesAndNotifyObservers() {
        val terminal = DeferredTerminal(reader)
        val notifications = mutableListOf<NativeCollectionState>()
        val runtime = runtime(terminal)
        runtime.initialize(); runtime.setStateListener { notifications += runtime.state }
        runtime.discover()
        assertFalse(runtime.readerSelectionReachable); assertFalse(runtime.readerConnectionReachable)
        terminal.publishReaders()
        assertTrue(runtime.readerSelectionReachable); assertFalse(runtime.readerConnectionReachable)
        runtime.selectReader(reader)
        assertFalse(runtime.readerSelectionReachable); assertTrue(runtime.readerConnectionReachable)
        assertTrue(notifications.containsAll(listOf(NativeCollectionState.DISCOVERING, NativeCollectionState.READERS_AVAILABLE, NativeCollectionState.READER_SELECTED)))
    }

    @Test fun scheduledDeadlineCancelsCancellableWorkAndRecoversSameIdWithoutAwaitingCallback() {
        val terminal = DeferredTerminal(reader).apply { retrieveImmediately = true; deferCollect = true }
        val scheduler = RecordingScheduler()
        val recovery = RecordingRecovery()
        val runtime = runtime(terminal, recovery, scheduler)
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")
        val cancellationsBeforeDeadline = terminal.cancellations
        scheduler.fire()
        assertEquals(cancellationsBeforeDeadline + 1, terminal.cancellations)
        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        assertTrue(recovery.ids.isEmpty())
        terminal.completeCollectSuccess() // Terminal cancellation completion cannot revive collection.
        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.UNRESOLVED, runtime.state)
    }

    @Test fun noncancellableRetrieveTimeoutIgnoresLateSuccessAndFailsClosed() {
        val terminal = DeferredTerminal(reader).apply { nonCancellableRetrieve = true }
        val scheduler = RecordingScheduler()
        val recovery = RecordingRecovery()
        val runtime = runtime(terminal, recovery, scheduler)
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")
        scheduler.fire()
        terminal.completeRetrieve("pi_same")
        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.UNRESOLVED, runtime.state)
        assertTrue(terminal.operations.none { it.startsWith("collect") })
    }

    @Test fun permissionLossDuringNoncancellableRetrieveRecoversSameIdOnceAndIgnoresLateCallback() {
        val terminal = DeferredTerminal(reader).apply { nonCancellableRetrieve = true }
        val recovery = RecordingRecovery()
        val runtime = runtime(terminal, recovery)
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")

        runtime.onBluetoothPermissionResult(false)
        assertEquals(listOf("pi_same"), recovery.ids)
        terminal.completeRetrieve("pi_same")

        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.RECONNECT_REQUIRED, runtime.state)
        assertTrue(runtime.readerDiscoveryReachable)
        assertTrue(terminal.operations.none { it.startsWith("collect") })
    }

    @Test fun disconnectRecoveryHonorsServerPaidWithoutRequiringReaderReconnect() {
        val terminal = DeferredTerminal(reader).apply { retrieveImmediately = true; deferCollect = true }
        val recovery = RecordingRecovery(PaymentResult("pi_same", "succeeded", true))
        val runtime = runtime(terminal, recovery)
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")

        runtime.onReaderDisconnected()
        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        terminal.completeCollectFailure()

        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.PAID, runtime.state)
    }

    @Test fun actualTicketExpiryDuringCollectCancelsThenRecoversTheRetainedId() {
        var clock = now
        val expiringTicket = ticket.copy(expiresAt = now + 1)
        val terminal = DeferredTerminal(reader).apply { retrieveImmediately = true; deferCollect = true }
        val recovery = RecordingRecovery()
        val runtime = NativeCollectionRuntime(
            NativeCollectionConfiguration(origin, true), session, expiringTicket, terminal, Permissions(),
            object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" }, recovery, { clock },
        )
        runtime.initialize(); runtime.discover(); terminal.publishReaders(); runtime.selectReader(reader); runtime.connectSelectedReader(); terminal.completeConnect()
        runtime.start(DurableAttempt(expiringTicket, "pi_same"), "secret")

        clock++
        runtime.onApplicationResumed()
        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        terminal.completeCollectFailure()

        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.RECONNECT_REQUIRED, runtime.state)
    }

    @Test fun cancellableCollectWaitsInCancellingForItsTerminalCallbackBeforeOneRecovery() {
        val terminal = DeferredTerminal(reader).apply { retrieveImmediately = true; deferCollect = true }
        val recovery = RecordingRecovery()
        val runtime = runtime(terminal, recovery)
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")

        runtime.cancel()

        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        assertTrue(recovery.ids.isEmpty())
        terminal.completeCollectFailure()
        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.UNRESOLVED, runtime.state)
    }

    @Test fun cancellableConfirmAlsoWaitsForTerminalCallbackBeforeOneRecovery() {
        val terminal = DeferredTerminal(reader).apply { retrieveImmediately = true; deferConfirm = true }
        val recovery = RecordingRecovery()
        val runtime = runtime(terminal, recovery)
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")

        runtime.cancel()
        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        terminal.completeConfirmFailure()

        assertEquals(listOf("pi_same"), recovery.ids)
        assertEquals(NativeCollectionState.UNRESOLVED, runtime.state)
    }

    @Test fun staleDiscoveryAndConnectCallbacksCannotRestoreInvalidatedReader() {
        val terminal = DeferredTerminal(reader)
        val runtime = runtime(terminal)
        runtime.initialize(); runtime.discover(); runtime.onApplicationBackgrounded()
        terminal.publishReaders()
        assertTrue(runtime.discoveredReaders.isEmpty())
        assertFalse(runtime.readerSelectionReachable)
    }

    @Test fun staleNoncancellableConnectIsPhysicallyDisconnectedAndKeepsManualReconnectRequired() {
        val terminal = DeferredTerminal(reader)
        val runtime = runtime(terminal)
        runtime.initialize(); runtime.discover(); terminal.publishReaders(); runtime.selectReader(reader)
        runtime.connectSelectedReader()
        runtime.onApplicationBackgrounded()
        terminal.completeConnect()

        assertEquals(1, terminal.disconnects)
        assertEquals(NativeCollectionState.RECONNECT_REQUIRED, runtime.state)
        assertFalse(runtime.paymentActionsReachable)
    }

    @Test fun onStartRevalidationDoesNothingWhenAuthorityIsValidButCancelsWhenObservedReaderDisappears() {
        val terminal = DeferredTerminal(reader).apply { retrieveImmediately = true; deferCollect = true }
        val recovery = RecordingRecovery()
        var observedReaderId: String? = reader.id
        val runtime = NativeCollectionRuntime(
            NativeCollectionConfiguration(origin, true), session, ticket, terminal, Permissions(),
            object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" }, recovery, { now },
            authority = { NativeCollectionAuthority(session, ticket, observedReaderId) },
        )
        connect(runtime, terminal)
        runtime.start(DurableAttempt(ticket, "pi_same"), "secret")
        runtime.onApplicationResumed()
        assertEquals(NativeCollectionState.COLLECTING, runtime.state)

        observedReaderId = null
        runtime.onApplicationResumed()
        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        terminal.completeCollectFailure()
        assertEquals(listOf("pi_same"), recovery.ids)
    }

    @Test fun productionExecutorRunsNetworkWorkOffTheUiThread() {
        val done = CountDownLatch(1)
        var invokedOnUiThread = true
        AndroidOperatorBackgroundExecutor().execute {
            invokedOnUiThread = android.os.Looper.myLooper() == android.os.Looper.getMainLooper()
            done.countDown()
        }
        assertTrue(done.await(2, TimeUnit.SECONDS))
        assertFalse(invokedOnUiThread)
    }

    private fun connect(runtime: NativeCollectionRuntime, terminal: DeferredTerminal) {
        runtime.initialize(); runtime.discover(); terminal.publishReaders(); runtime.selectReader(reader); runtime.connectSelectedReader(); terminal.completeConnect()
    }
    private fun runtime(terminal: DeferredTerminal, recovery: RecordingRecovery = RecordingRecovery(), scheduler: CollectionDeadlineScheduler = NoopCollectionDeadlineScheduler) = NativeCollectionRuntime(
        NativeCollectionConfiguration(origin, true), session, ticket, terminal, Permissions(),
        object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" }, recovery, { now },
        deadlineScheduler = scheduler,
    )
    private class Permissions : BluetoothPermissions { override fun hasBluetoothPermissions() = true; override fun requestBluetoothPermissions() = Unit }
    private class RecordingScheduler : CollectionDeadlineScheduler {
        private var task: (() -> Unit)? = null
        override fun schedule(delayMs: Long, task: () -> Unit): NativeCancelable { this.task = task; return NativeCancelable { this.task = null } }
        fun fire() = requireNotNull(task).invoke()
    }
    private class RecordingRecovery(
        private val result: PaymentResult = PaymentResult("pi_same", "processing", false),
    ) : PaymentRecovery {
        val ids = mutableListOf<String>()
        override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState {
            ids += paymentIntentId
            return RecoveryState.FromServer(result)
        }
    }
    private class DeferredTerminal(private val reader: ConnectedReader) : NativeTerminalAdapter {
        var retrieveImmediately = false; var deferCollect = false; var deferConfirm = false; var nonCancellableRetrieve = false; var cancellations = 0; var disconnects = 0
        val operations = mutableListOf<String>()
        private var discover: ((List<ConnectedReader>) -> Unit)? = null
        private var connect: (() -> Unit)? = null
        private var retrieve: ((String) -> Unit)? = null
        private var collect: ((String) -> Unit)? = null
        private var collectFailure: (() -> Unit)? = null
        private var confirmFailure: (() -> Unit)? = null
        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun disconnect() { disconnects++ }
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable { discover = onUpdate; return cancelable() }
        fun publishReaders() = requireNotNull(discover).invoke(listOf(reader))
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable { connect = onSuccess; return NonCancellableTerminalOperation }
        fun completeConnect() = requireNotNull(connect).invoke()
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "retrieve"; retrieve = onSuccess; if (retrieveImmediately) onSuccess("pi_same"); return if (nonCancellableRetrieve) NonCancellableTerminalOperation else cancelable()
        }
        fun completeRetrieve(id: String) = requireNotNull(retrieve).invoke(id)
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "collect"; collect = onSuccess; collectFailure = onFailure
            if (!deferCollect) onSuccess(paymentIntentId)
            return cancelable()
        }
        fun completeCollectSuccess() = requireNotNull(collect).invoke("pi_same")
        fun completeCollectFailure() = requireNotNull(collectFailure).invoke()
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "confirm"; confirmFailure = onFailure
            if (!deferConfirm) onSuccess(paymentIntentId)
            return cancelable()
        }
        fun completeConfirmFailure() = requireNotNull(confirmFailure).invoke()
        private fun cancelable() = NativeCancelable { cancellations++ }
    }
}
