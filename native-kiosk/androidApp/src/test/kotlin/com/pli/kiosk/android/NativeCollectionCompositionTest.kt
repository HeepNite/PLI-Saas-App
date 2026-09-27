package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NativeCollectionCompositionTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session-a", "cookie", now + 120_000)
    private val ticket = AttemptTicket("ticket", now + 120_000, "tmr_fixture", Approved.LOCATION)
    private val reader = ConnectedReader(ticket.readerId, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    @Test fun blankOrInsecureOriginAndDisabledFlagFailClosed() {
        listOf("", "http://approved.invalid").forEach {
            assertFailsWith<IllegalArgumentException> { NativeCollectionConfiguration(it, true) }
        }
        val runtime = runtime(enabled = false)
        assertFalse(runtime.paymentActionsReachable)
        assertFailsWith<IllegalStateException> { runtime.initialize() }
        assertFailsWith<IllegalStateException> { runtime.discover() }
    }

    @Test fun initializeOnceAndTokenProviderUsesOnlyOriginalSessionConnectionTokenAction() {
        val terminal = FakeTerminal()
        val tokens = FakeConnectionTokens()
        val runtime = runtime(terminal = terminal, tokens = tokens)

        runtime.initialize()
        runtime.initialize()
        terminal.requestConnectionToken()

        assertEquals(1, terminal.initializations)
        assertEquals(listOf(session.association), tokens.sessions)
    }

    @Test fun discoveryNeedsPermissionAndConnectIsExplicitWithPhysicalPolicyAndAutoReconnectOff() {
        val terminal = FakeTerminal().apply { discovered = listOf(reader) }
        val permissions = FakePermissions(granted = false)
        val runtime = runtime(terminal = terminal, permissions = permissions)
        runtime.initialize()

        assertFailsWith<IllegalStateException> { runtime.discover() }
        assertEquals(1, permissions.requests)
        permissions.granted = true
        runtime.discover()
        assertEquals(listOf(reader), runtime.discoveredReaders)
        assertFailsWith<IllegalArgumentException> { runtime.selectReader(reader.copy(serial = "other")) }
        runtime.selectReader(reader)
        runtime.connectSelectedReader()

        assertEquals(BluetoothDiscoveryRequest(NativeCollectionRuntime.DISCOVERY_TIMEOUT_MS, false), terminal.discoveryRequest)
        assertEquals(BluetoothConnectionRequest(Approved.LOCATION, false), terminal.connectionRequest)
        assertTrue(runtime.paymentActionsReachable)
    }

    @Test fun durableSameIdSequenceKeepsSecretTransientAndOnlyFreshServerRecoveryCanMarkPaid() {
        val terminal = FakeTerminal().apply { discovered = listOf(reader) }
        val recovery = FakeRecovery(PaymentResult("pi_fixture", "succeeded", true))
        val runtime = connectedRuntime(terminal, recovery)
        val durable = DurableAttempt(ticket, "pi_fixture")

        runtime.start(durable, "secret_transient")

        assertEquals(listOf("retrieve:secret_transient", "collect:pi_fixture", "confirm:pi_fixture"), terminal.operations)
        assertFalse(runtime.clientSecretRetained)
        assertEquals(NativeCollectionState.PAID, runtime.state)
        assertEquals(listOf("pi_fixture"), recovery.recoveries)
        assertEquals("pi_fixture", durable.paymentIntentId)
    }

    @Test fun cancellationTimeoutAndInvalidationCancelThenRecoverSameIdWithoutReplacementOrReconnect() {
        var clock = now
        val terminal = FakeTerminal().apply {
            discovered = listOf(reader)
            deferCollect = true
        }
        val recovery = FakeRecovery(PaymentResult("pi_fixture", "processing", false))
        val runtime = connectedRuntime(terminal, recovery, clock = { clock })
        val durable = DurableAttempt(ticket, "pi_fixture")

        runtime.start(durable, "secret_transient")
        assertEquals(NativeCollectionState.COLLECTING, runtime.state)
        clock += NativeCollectionRuntime.COLLECTION_TIMEOUT_MS
        runtime.onTimeAdvanced()
        assertEquals(1, terminal.cancellations)
        assertEquals(NativeCollectionState.CANCELLING, runtime.state)
        assertTrue(recovery.recoveries.isEmpty())
        terminal.completeActiveOperation()

        assertEquals(NativeCollectionState.UNRESOLVED, runtime.state)
        assertEquals(listOf("pi_fixture"), recovery.recoveries)
        assertEquals(1, terminal.connectCalls)
        assertEquals("pi_fixture", durable.paymentIntentId)

        runtime.onReaderDisconnected()
        assertFalse(runtime.paymentActionsReachable)
        assertEquals(1, terminal.connectCalls)
    }

    @Test fun serverRecoverySelectsManualAndUnresolvedButSdkCompletionNeverDoes() {
        val terminal = FakeTerminal().apply { discovered = listOf(reader) }
        val recovery = FakeRecovery(PaymentResult("pi_fixture", "requires_action", false, null), manual = true)
        val runtime = connectedRuntime(terminal, recovery)

        runtime.start(DurableAttempt(ticket, "pi_fixture"), "secret")

        assertEquals(NativeCollectionState.MANUAL_RECONCILIATION, runtime.state)
        assertEquals(1, recovery.recoveries.size)
    }

    @Test fun invalidationWhileRecoveryIsPendingRestartsRecoveryWithoutStrandingCancellation() {
        val executor = QueuedExecutor()
        val recovery = FakeRecovery(PaymentResult("pi_fixture", "processing", false))
        val runtime = connectedRuntime(FakeTerminal().apply { discovered = listOf(reader) }, recovery, executor = executor)

        runtime.start(DurableAttempt(ticket, "pi_fixture"), "secret")
        assertEquals(NativeCollectionState.RECOVERING, runtime.state)
        runtime.onReaderDisconnected()

        assertEquals(NativeCollectionState.RECOVERING, runtime.state)
        assertEquals(2, executor.pending)
        executor.runNext()
        assertEquals(NativeCollectionState.RECOVERING, runtime.state)
        executor.runNext()
        assertEquals(NativeCollectionState.RECONNECT_REQUIRED, runtime.state)
    }

    @Test fun onlyLatestOverlappingRecoveryMayDecidePaymentStatus() {
        val executor = QueuedExecutor()
        val recovery = SequencedRecovery(listOf(
            PaymentResult("pi_fixture", "succeeded", true),
            PaymentResult("pi_fixture", "processing", false),
        ))
        val runtime = connectedRuntime(FakeTerminal().apply { discovered = listOf(reader) }, recovery, executor = executor)

        runtime.start(DurableAttempt(ticket, "pi_fixture"), "secret")
        runtime.recover()
        executor.runNext()
        assertEquals(NativeCollectionState.RECOVERING, runtime.state)
        executor.runNext()
        assertEquals(NativeCollectionState.UNRESOLVED, runtime.state)
    }

    private fun connectedRuntime(
        terminal: FakeTerminal,
        recovery: PaymentRecovery,
        clock: () -> Long = { now },
        executor: NativeBackgroundExecutor = DirectNativeBackgroundExecutor,
    ): NativeCollectionRuntime = runtime(terminal = terminal, recovery = recovery, clock = clock, executor = executor).also {
        it.initialize()
        it.discover()
        it.selectReader(reader)
        it.connectSelectedReader()
    }

    private fun runtime(
        enabled: Boolean = true,
        terminal: FakeTerminal = FakeTerminal(),
        tokens: FakeConnectionTokens = FakeConnectionTokens(),
        permissions: FakePermissions = FakePermissions(),
        recovery: PaymentRecovery = FakeRecovery(PaymentResult("pi_fixture", "processing", false)),
        clock: () -> Long = { now },
        executor: NativeBackgroundExecutor = DirectNativeBackgroundExecutor,
    ) = NativeCollectionRuntime(
        NativeCollectionConfiguration(origin.value, enabled),
        session,
        ticket,
        terminal,
        permissions,
        tokens,
        recovery,
        clock,
        backgroundExecutor = executor,
    )

    private class FakePermissions(var granted: Boolean = true) : BluetoothPermissions {
        var requests = 0
        override fun hasBluetoothPermissions(): Boolean = granted
        override fun requestBluetoothPermissions() { requests++ }
    }

    private class FakeConnectionTokens : ConnectionTokenSource {
        val sessions = mutableListOf<String>()
        override fun connectionToken(session: StaffSession): String {
            sessions += session.association
            return "token"
        }
    }

    private class FakeRecovery(
        private val result: PaymentResult,
        private val manual: Boolean = false,
    ) : PaymentRecovery {
        val recoveries = mutableListOf<String>()
        override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState {
            recoveries += paymentIntentId
            return if (manual) RecoveryState.ManualReconciliation else RecoveryState.FromServer(result)
        }
    }

    private class SequencedRecovery(results: List<PaymentResult>) : PaymentRecovery {
        private val remaining = results.toMutableList()
        override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
            RecoveryState.FromServer(remaining.removeAt(0))
    }

    private class QueuedExecutor : NativeBackgroundExecutor {
        private val tasks = mutableListOf<() -> Unit>()
        val pending get() = tasks.size
        override fun execute(task: () -> Unit) { tasks += task }
        fun runNext() = tasks.removeAt(0).invoke()
    }

    private class FakeTerminal : NativeTerminalAdapter {
        var initializations = 0
        var discoveryRequest: BluetoothDiscoveryRequest? = null
        var connectionRequest: BluetoothConnectionRequest? = null
        var discovered: List<ConnectedReader> = emptyList()
        val operations = mutableListOf<String>()
        var deferCollect = false
        var cancellations = 0
        var connectCalls = 0
        private var active: (() -> Unit)? = null

        private var connectionTokenProvider: (() -> String)? = null
        override fun initialize(connectionTokenProvider: () -> String) {
            initializations++
            this.connectionTokenProvider = connectionTokenProvider
        }
        fun requestConnectionToken() = requireNotNull(connectionTokenProvider).invoke()
        override fun discover(
            request: BluetoothDiscoveryRequest,
            onUpdate: (List<ConnectedReader>) -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            discoveryRequest = request
            onUpdate(discovered)
            return NativeCancelable {}
        }
        override fun connect(
            reader: ConnectedReader,
            request: BluetoothConnectionRequest,
            onDisconnect: () -> Unit,
            onSuccess: () -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            connectCalls++
            connectionRequest = request
            onSuccess()
            return cancelable()
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "retrieve:$clientSecret"
            onSuccess("pi_fixture")
            return cancelable()
        }
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "collect:$paymentIntentId"
            if (deferCollect) active = { onSuccess(paymentIntentId) } else onSuccess(paymentIntentId)
            return cancelable()
        }
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "confirm:$paymentIntentId"
            onSuccess(paymentIntentId)
            return cancelable()
        }
        fun completeActiveOperation() { active?.also { active = null }?.invoke() }
        private fun cancelable() = NativeCancelable { cancellations++ }
    }
}
