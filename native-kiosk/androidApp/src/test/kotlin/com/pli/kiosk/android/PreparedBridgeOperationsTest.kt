package com.pli.kiosk.android

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class PreparedBridgeOperationsTest {
    @Test
    fun startForwardsExactValidatedReferencesAndOnlyItsCompletionMayReportPaid() {
        lateinit var operations: PreparedBridgeOperations
        val preparedOne = preparedReference()
        val preparedTwo = preparedReference('B')
        val completions = mutableMapOf<String, (PreparedRecoveryState) -> Unit>()
        val workflow = PreparedBridgeWorkflow { operation, prepared, completion ->
            assertEquals(SecureBridgeState.PENDING, operations.poll(operation))
            assertEquals(if (operation == "opaque-one") preparedOne else preparedTwo, prepared)
            completions[operation] = completion
        }
        operations = PreparedBridgeOperations(workflow, capacity = 2)
        val bridge = bridge(operations)

        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"$preparedOne\"}")).state)
        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(request("two", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"$preparedTwo\"}")).state)
        completions.getValue("opaque-one")(PreparedRecoveryState.PAID)

        val paid = poll(bridge, "state-one", "opaque-one")
        assertTrue(paid.state == SecureBridgeState.PAID && paid.operationRef == "opaque-one" && paid.operationRef != "opaque-state-one")
        assertEquals(SecureBridgeState.PENDING, poll(bridge, "state-two", "opaque-two").state)
    }

    @Test
    fun diagnosticRoundTripHasAnEmptySchemaAndCannotLaunchThePreparedWorkflow() {
        var launches = 0
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> launches++ })
        val bridge = bridge(operations)

        val accepted = bridge.dispatch(request("diagnostic", PreparedBridgeOperations.DIAGNOSTIC, "{}"))
        val rejected = bridge.dispatch(request("diagnostic-extra", PreparedBridgeOperations.DIAGNOSTIC, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}"))

        assertEquals(SecureBridgeState.ACCEPTED, accepted.state)
        assertEquals("opaque-diagnostic", accepted.operationRef)
        assertEquals(null, rejected.state)
        assertEquals(SecureBridgeError.INVALID_PAYLOAD, rejected.error)
        assertEquals(0, launches)
    }

    @Test
    fun collidingGeneratedReferencesRejectBeforeInsertionOrSecondLaunch() {
        var launches = 0
        var complete: ((PreparedRecoveryState) -> Unit)? = null
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, callback -> launches++; complete = callback }, capacity = 2)
        val bridge = SecureWebBridge(operations.bridgeOperations()) { _, _ -> "colliding-reference" }

        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}")).state)
        complete?.invoke(PreparedRecoveryState.PAID)
        assertEquals(SecureBridgeState.PAID, operations.poll("colliding-reference"))
        val rejected = bridge.dispatch(request("two", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference('B')}\"}"))
        assertTrue(rejected.state == SecureBridgeState.REJECTED && rejected.operationRef == null)
        assertEquals(SecureBridgeState.PAID, operations.poll("colliding-reference"))
        assertEquals(1, launches)
    }

    @Test
    fun startAndPollUseClosedSchemasAndDoNotExposeInput() {
        val bridge = bridge(PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> }))
        val secret = "provider-secret"
        val cases = listOf(
            request("missing", PreparedBridgeOperations.START, "{}"),
            request("extra", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\",\"extra\":\"x\"}"),
            request("poll-extra", PreparedBridgeOperations.POLL, "{\"operationReference\":\"opaque\",\"extra\":\"x\"}"),
            request("secret", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"$secret\"}"),
        )

        cases.forEach { response ->
            val reply = bridge.dispatch(response)
            assertTrue(reply.error == SecureBridgeError.INVALID_PAYLOAD || reply.state == SecureBridgeState.REJECTED)
            assertFalse(reply.toString().contains(secret))
            assertFalse(reply.operationRef?.contains(secret) == true)
        }
    }

    @Test
    fun duplicateStartIsCachedAndFullRegistryNeverEvictsUnresolvedOperations() {
        var launches = 0
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> launches++ }, capacity = 1)
        val bridge = bridge(operations)
        val first = request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}")

        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(first).state)
        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(first).state)
        assertEquals(SecureBridgeState.REJECTED, bridge.dispatch(request("two", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference('B')}\"}")).state)
        assertEquals(1, launches)
    }

    @Test
    fun unknownCrossContextAndStaleReferencesRejectWithoutDiagnostics() {
        val first = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> })
        val second = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> })
        val bridge = bridge(first)
        val response = bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}"))
        val reference = requireNotNull(response.operationRef)

        val unknown = poll(bridge, "unknown", "opaque-unknown")
        assertTrue(unknown.state == SecureBridgeState.REJECTED && unknown.operationRef == null)
        val crossContext = poll(bridge(second), "cross-context", reference)
        assertTrue(crossContext.state == SecureBridgeState.REJECTED && crossContext.operationRef == null)
        first.invalidate()
        val stale = poll(bridge, "stale", reference)
        assertTrue(stale.state == SecureBridgeState.REJECTED && stale.operationRef == null)
        assertFalse(stale.toString().contains(reference))
    }

    @Test
    fun lateCompletionAfterInvalidationCannotResurrectOperation() {
        var complete: ((PreparedRecoveryState) -> Unit)? = null
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, callback -> complete = callback })
        val bridge = bridge(operations)
        bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}"))

        operations.invalidate()
        complete?.invoke(PreparedRecoveryState.PAID)

        assertTrue(operations.poll("opaque-one") == SecureBridgeState.REJECTED)
    }

    @Test
    fun terminalCompletionCannotBeRewrittenByLaterCallbacks() {
        lateinit var completion: (PreparedRecoveryState) -> Unit
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, callback -> completion = callback })
        assertEquals(SecureBridgeState.PENDING, operations.start("operation", preparedReference()))
        completion(PreparedRecoveryState.PAID)
        completion(PreparedRecoveryState.REJECTED)
        completion(PreparedRecoveryState.PENDING)
        assertEquals(SecureBridgeState.PAID, operations.poll("operation"))
    }

    @Test
    fun lifecycleRegistryInvalidatesBeforeForwardingAndPermissionDoesNotInvalidate() {
        lateinit var operations: PreparedBridgeOperations
        lateinit var callback: (PreparedRecoveryState) -> Unit
        val events = mutableListOf<String>()
        val workflow = object : PreparedBridgeWorkflow, PreparedBridgeLifecycle {
            override fun launch(operationReference: String, preparedPurchaseReference: String, completion: (PreparedRecoveryState) -> Unit) { callback = completion }
            override fun onBluetoothPermissionResult(granted: Boolean) { events += "permission:$granted" }
            override fun onApplicationBackgrounded() { events += "background:${operations.poll("operation")}" }
            override fun onSessionInvalidated() = Unit
            override fun onReaderInvalidated() = Unit
        }
        operations = PreparedBridgeOperations(workflow)
        operations.start("operation", preparedReference())
        operations.onBluetoothPermissionResult(true)
        operations.onApplicationBackgrounded()
        callback(PreparedRecoveryState.PAID)

        assertEquals(listOf("permission:true", "background:REJECTED"), events)
        assertEquals(SecureBridgeState.REJECTED, operations.poll("operation"))
    }

    @Test
    fun productionWorkflowQueuesConcurrentTerminalAfterBlockedPendingDelivery() {
        val entered = CountDownLatch(1); val release = CountDownLatch(1); val terminalPublished = CountDownLatch(1)
        val fixture = productionWorkflow(); val results = mutableListOf<PreparedRecoveryState>()
        fixture.workflow.launch("operation", preparedReference()) { state ->
            results += state
            if (state == PreparedRecoveryState.PENDING) { entered.countDown(); release.await() }
        }
        val worker = Thread { fixture.queued.runNext() }.also { it.start() }
        assertTrue(entered.await(1, TimeUnit.SECONDS))
        val terminal = Thread { fixture.workflow.onSessionInvalidated(); terminalPublished.countDown() }.also { it.start() }
        assertTrue(terminalPublished.await(1, TimeUnit.SECONDS))
        assertEquals(listOf(PreparedRecoveryState.PENDING), results)

        release.countDown(); worker.join(1_000); terminal.join(1_000)
        assertFalse(worker.isAlive); assertFalse(terminal.isAlive)
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
    }

    @Test
    fun productionWorkflowKeepsOwnershipWhileCollectionPreparationBegins() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val fixture = productionWorkflow(beforeCollection = { entered.countDown(); release.await() })
        val results = mutableListOf<PreparedRecoveryState>()
        fixture.workflow.launch("operation", preparedReference(), results::add)
        val worker = Thread { fixture.queued.runNext() }.also { it.start() }
        assertTrue(entered.await(1, TimeUnit.SECONDS))

        val invalidated = CountDownLatch(1)
        Thread { fixture.workflow.onSessionInvalidated(); invalidated.countDown() }.start()
        assertFalse(invalidated.await(100, TimeUnit.MILLISECONDS))
        release.countDown()
        assertTrue(invalidated.await(1, TimeUnit.SECONDS))
        worker.join()

        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
    }

    @Test
    fun productionLifecycleRoutesOnlyItsBlockedBootstrapAndPoisonsLateReadyCallbacks() {
        val denied = productionWorkflow(bootstrapPermissionGranted = false)
        val deniedResults = mutableListOf<PreparedRecoveryState>()
        denied.workflow.launch("denied", preparedReference(), deniedResults::add)
        denied.queued.runAll(); denied.workflow.onBluetoothPermissionResult(false)

        listOf<(ProductionPreparedBridgeWorkflow) -> Unit>(
            { it.onApplicationBackgrounded() }, { it.onSessionInvalidated() }, { it.onReaderInvalidated() },
        ).forEachIndexed { index, invalidate ->
            val fixture = productionWorkflow(bootstrapPermissionGranted = false, deferBootstrapConnection = true)
            val results = mutableListOf<PreparedRecoveryState>()
            fixture.workflow.launch("operation-$index", preparedReference(('B'.code + index).toChar()), results::add)
            fixture.queued.runAll(); fixture.workflow.onBluetoothPermissionResult(true); fixture.workflow.onBluetoothPermissionResult(false)
            assertEquals(listOf(PreparedRecoveryState.PENDING), results)
            invalidate(fixture.workflow); fixture.bootstrap.completeConnection(); fixture.queued.runAll()
            assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
            assertEquals(null, fixture.terminal.secret)
        }
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), deniedResults)
    }

    @Test
    fun productionWorkflowSchedulesExactAdmissionAndRejectsBeforeBootstrapOnFactoryFailure() {
        val queued = QueuedExecutor()
        val ticket = AttemptTicket("ticket", 2_000L, "tmr_exact", Approved.LOCATION)
        val prepared = RecordingPreparedApi(ticket)
        val coordinator = coordinator(prepared)
        var bootstrapFactories = 0
        val results = mutableListOf<PreparedRecoveryState>()
        val workflow = ProductionPreparedBridgeWorkflow(
            coordinator,
            queued,
            NativeCollectionRuntimeFactory { throw IllegalStateException("runtime factory failed") },
            PinnedReaderBootstrapRuntimeFactory { _, _ -> bootstrapFactories++; error("must not bootstrap") },
            ticket.readerId,
            clock = { 1_000L },
        )

        workflow.launch("operation", preparedReference()) { results += it }

        assertTrue(prepared.references.isEmpty())
        assertTrue(results.isEmpty())
        queued.runAll()
        assertEquals(listOf(preparedReference()), prepared.references)
        assertEquals(0, bootstrapFactories)
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
    }

    @Test
    fun productionWorkflowPassesExactAttemptAndRuntimeToBootstrapFactory() {
        val fixture = productionWorkflow()

        fixture.workflow.launch("operation", preparedReference()) {}
        fixture.queued.runAll()

        assertTrue(fixture.bootstrapAttempt === fixture.runtimeAttempt)
        assertTrue(fixture.bootstrapRuntime === fixture.runtime)
    }

    @Test
    fun productionWorkflowUsesOneReadyBootstrapAndDoubleFreshRecoveryBeforePaid() {
        val fixture = productionWorkflow()
        val results = mutableListOf<PreparedRecoveryState>()

        fixture.workflow.launch("operation", preparedReference()) { results += it }
        fixture.queued.runAll()

        assertEquals(listOf(preparedReference()), fixture.prepared.references)
        assertEquals(listOf<String?>(null), fixture.prepared.paymentIds)
        assertEquals(listOf("pi_exact"), fixture.prepared.recoveries)
        assertEquals("secret_exact", fixture.terminal.secret)
        assertEquals(1, fixture.terminal.recoveries)
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.PAID), results)
    }

    @Test
    fun productionWorkflowRejectsAsyncCollectionStartFailureWithoutResurrection() {
        val fixture = productionWorkflow(failCollection = true, deferBootstrapConnection = true); val results = mutableListOf<PreparedRecoveryState>()
        fixture.workflow.launch("operation", preparedReference()) { results += it }; fixture.queued.runAll()
        repeat(2) { fixture.bootstrap.completeConnection() }
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
    }

    @Test
    fun productionWorkflowCleansTerminalHandleBeforeThrowingCompletionCanReenterLifecycle() {
        val fixture = productionWorkflow()
        val results = mutableListOf<PreparedRecoveryState>()
        val completionFailure = IllegalStateException("completion failed")

        fixture.workflow.launch("operation", preparedReference()) { state ->
            results += state
            if (state == PreparedRecoveryState.PAID) {
                fixture.workflow.onApplicationBackgrounded()
                throw completionFailure
            }
        }

        val failure = assertFailsWith<IllegalStateException> { fixture.queued.runAll() }

        assertTrue(failure === completionFailure)
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.PAID), results)
        assertEquals(NativeCollectionState.PAID, fixture.runtime.state)
        fixture.workflow.onSessionInvalidated()
        fixture.workflow.onBluetoothPermissionResult(false)
        assertEquals(NativeCollectionState.PAID, fixture.runtime.state)
    }

    @Test
    fun productionWorkflowCleansRejectedHandleBeforeThrowingCompletionCanReenterLifecycle() {
        val fixture = productionWorkflow(bootstrapPermissionGranted = false)
        val results = mutableListOf<PreparedRecoveryState>()
        val completionFailure = IllegalStateException("completion failed")

        fixture.workflow.launch("operation", preparedReference()) { state ->
            results += state
            if (state == PreparedRecoveryState.REJECTED) {
                fixture.workflow.onSessionInvalidated()
                throw completionFailure
            }
        }
        fixture.queued.runAll()

        val failure = assertFailsWith<IllegalStateException> { fixture.runtime.onReaderDisconnected() }

        assertTrue(failure === completionFailure)
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
        assertEquals(0, fixture.bootstrap.discoverCalls)
        fixture.workflow.onBluetoothPermissionResult(true)
        assertEquals(0, fixture.bootstrap.discoverCalls)
    }

    @Test
    fun productionWorkflowPropagatesTerminalCompletionFailureThroughSynchronousRuntimeStart() {
        val fixture = productionWorkflow(backgroundExecutor = DirectExecutor())
        val completionFailure = IllegalStateException("completion failed")
        val failure = assertFailsWith<IllegalStateException> {
            fixture.workflow.launch("operation", preparedReference()) { state ->
                if (state == PreparedRecoveryState.PAID) throw completionFailure
            }
        }

        assertTrue(failure === completionFailure)
        assertEquals(NativeCollectionState.PAID, fixture.runtime.state)
    }

    @Test
    fun productionWorkflowRejectsUnresolvedAndCannotResurrectItAfterPaidRecovery() {
        var paid = false
        val fixture = productionWorkflow(recoveredPaid = { paid })
        val results = mutableListOf<PreparedRecoveryState>()

        fixture.workflow.launch("operation", preparedReference()) { results += it }
        fixture.queued.runAll()
        assertEquals(NativeCollectionState.UNRESOLVED, fixture.runtime.state)
        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
        paid = true
        fixture.runtime.recover()
        fixture.queued.runAll()

        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
    }

    @Test
    fun productionWorkflowRejectsReconnectRequiredAndCannotResurrectItAfterPaidRecovery() {
        var paid = false
        val fixture = productionWorkflow(recoveredPaid = { paid }, beforeConfirm = { it.onReaderDisconnected() })
        val results = mutableListOf<PreparedRecoveryState>()

        fixture.workflow.launch("operation", preparedReference()) { results += it }
        fixture.queued.runAll()
        paid = true
        fixture.runtime.recover()
        fixture.queued.runAll()

        assertEquals(listOf(PreparedRecoveryState.PENDING, PreparedRecoveryState.REJECTED), results)
    }

    private fun productionWorkflow(
        recoveredPaid: () -> Boolean = { true },
        beforeConfirm: (NativeCollectionRuntime) -> Unit = {},
        failCollection: Boolean = false,
        deferBootstrapConnection: Boolean = false,
        bootstrapPermissionGranted: Boolean = true,
        beforeCollection: () -> Unit = {},
        backgroundExecutor: OperatorBackgroundExecutor? = null,
    ): WorkflowFixture {
        val fixture = WorkflowFixture(failCollection, beforeCollection)
        fixture.terminal.beforeConfirm = { beforeConfirm(fixture.runtime) }
        fixture.workflow = ProductionPreparedBridgeWorkflow(
            coordinator(fixture.prepared), backgroundExecutor ?: fixture.queued,
            NativeCollectionRuntimeFactory { attempt ->
                assertEquals(AttemptMode.PREPARED, attempt.mode)
                fixture.runtimeAttempt = attempt
                NativeCollectionRuntime(
                    NativeCollectionConfiguration("https://approved.invalid", true), session(), requireNotNull(attempt.ticket), fixture.terminal,
                    GrantedPermissions(), object : ConnectionTokenSource {
                        override fun connectionToken(session: StaffSession) = "token"
                    }, object : PaymentRecovery {
                        override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState {
                            fixture.terminal.recoveries++
                            val paid = recoveredPaid()
                            return RecoveryState.FromServer(PaymentResult("pi_exact", if (paid) "succeeded" else "requires_action", paid))
                        }
                    }, { 1_000L },
                ).also { fixture.runtime = it }
            },
            PinnedReaderBootstrapRuntimeFactory { attempt, runtime ->
                fixture.bootstrapAttempt = attempt
                fixture.bootstrapRuntime = runtime
                ReadyBootstrapRuntime(reader(fixture.ticket), deferBootstrapConnection, bootstrapPermissionGranted) {
                    fixture.runtime.discover()
                    fixture.terminal.readers?.invoke(listOf(reader(fixture.ticket)))
                    fixture.runtime.selectReader(reader(fixture.ticket))
                    fixture.runtime.connectSelectedReader()
                    fixture.terminal.connected?.invoke()
                }.also { fixture.bootstrap = it }
            },
            fixture.ticket.readerId, clock = { 1_000L },
        )
        return fixture
    }

    private fun coordinator(prepared: RecordingPreparedApi): PurchaseCoordinator = PurchaseCoordinator(
        ApprovedOrigin("https://approved.invalid"), MemoryStore(DurableState(session())), LegacyApi(), { 1_000L }, prepared,
    )
    private fun session() = StaffSession("https://approved.invalid", "association", "cookie", 2_000L)
    private fun reader(ticket: AttemptTicket) = ConnectedReader(ticket.readerId, Approved.M2_SERIAL, "stripe_m2", ticket.locationId)

    private class WorkflowFixture(failCollection: Boolean = false, beforeCollection: () -> Unit = {}) {
        val ticket = AttemptTicket("ticket", 2_000L, "tmr_exact", Approved.LOCATION)
        val queued = QueuedExecutor()
        val prepared = RecordingPreparedApi(ticket, failCollection, beforeCollection)
        val terminal = RecordingTerminal()
        lateinit var bootstrap: ReadyBootstrapRuntime
        lateinit var runtime: NativeCollectionRuntime
        lateinit var runtimeAttempt: AttemptState
        lateinit var bootstrapAttempt: AttemptState
        lateinit var bootstrapRuntime: NativeCollectionRuntime
        lateinit var workflow: ProductionPreparedBridgeWorkflow
    }
    private class QueuedExecutor : OperatorBackgroundExecutor {
        private val tasks = mutableListOf<() -> Unit>()
        override fun execute(task: () -> Unit) { tasks += task }
        fun runNext() { if (tasks.isNotEmpty()) tasks.removeAt(0).invoke() }
        fun runAll() { while (tasks.isNotEmpty()) runNext() }
    }
    private class DirectExecutor : OperatorBackgroundExecutor {
        override fun execute(task: () -> Unit) = task()
    }
    private class MemoryStore(private var state: DurableState) : StateStore {
        override fun read() = state
        override fun write(state: DurableState) { this.state = state }
    }
    private class LegacyApi : PurchaseApi {
        override fun lookup(session: StaffSession, phone: String) = StudentLookupResult.Invalid
        override fun preflight(session: StaffSession) = Unit
        override fun issue(session: StaffSession, phone: String) = error("legacy issue")
        override fun prepare(session: StaffSession, ticket: AttemptTicket) = error("legacy prepare")
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String) = error("legacy recover")
    }
    private class RecordingPreparedApi(
        private val ticket: AttemptTicket,
        private val failCollection: Boolean = false,
        private val beforeCollection: () -> Unit = {},
    ) : PreparedPurchaseApi {
        val references = mutableListOf<String>()
        val paymentIds = mutableListOf<String?>()
        val recoveries = mutableListOf<String>()
        override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String): AttemptTicket = ticket.also { references += preparedPurchaseReference }
        override fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String?) =
            beforeCollection().let {
                if (failCollection) error("collection failed") else PaymentResult("pi_exact", "requires_payment_method", false, "secret_exact").also { paymentIds += paymentIntentId }
            }
        override fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
            PaymentResult("pi_exact", "succeeded", true).also { recoveries += paymentIntentId }
    }
    private class GrantedPermissions : BluetoothPermissions {
        override fun hasBluetoothPermissions() = true
        override fun requestBluetoothPermissions() = error("permission request")
    }
    private class ReadyBootstrapRuntime(
        private val reader: ConnectedReader,
        private val deferConnection: Boolean = false,
        private val permissionGranted: Boolean = true,
        private val beforeReady: () -> Unit,
    ) : PinnedReaderBootstrapRuntime {
        private var onConnected: (() -> Unit)? = null
        var discoverCalls = 0
        fun completeConnection() = onConnected?.invoke()
        override fun hasBluetoothPermission() = permissionGranted
        override fun requestBluetoothPermission() = Unit
        override fun discover(onReaders: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit) {
            discoverCalls++
            onReaders(listOf(reader))
        }
        override fun connect(reader: ConnectedReader, onConnected: (ConnectedReader) -> Unit, onDisconnected: () -> Unit, onFailure: () -> Unit) {
            beforeReady(); if (deferConnection) this.onConnected = { onConnected(reader) } else onConnected(reader)
        }
    }
    private class RecordingTerminal : NativeTerminalAdapter {
        var readers: ((List<ConnectedReader>) -> Unit)? = null
        var connected: (() -> Unit)? = null
        var beforeConfirm: () -> Unit = {}
        var secret: String? = null
        var recoveries = 0
        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable {
            readers = onUpdate; return NativeCancelable {}
        }
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            connected = onSuccess; return NativeCancelable {}
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            secret = clientSecret; onSuccess("pi_exact"); return NativeCancelable {}
        }
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            onSuccess(paymentIntentId); return NativeCancelable {}
        }
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            beforeConfirm(); onSuccess(paymentIntentId); return NativeCancelable {}
        }
    }

    private fun bridge(operations: PreparedBridgeOperations) = SecureWebBridge(operations.bridgeOperations()) { requestId, _ -> "opaque-$requestId" }
    private fun poll(bridge: SecureWebBridge, requestId: String, reference: String) =
        bridge.dispatch(request(requestId, PreparedBridgeOperations.POLL, "{\"operationReference\":\"$reference\"}"))
    private fun preparedReference(first: Char = 'A') = first + "A".repeat(42)
    private fun request(id: String, operation: String, payload: String) =
        "{\"version\":1,\"operation\":\"$operation\",\"requestId\":\"$id\",\"payload\":$payload}"
}
