package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
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
            PinnedReaderBootstrapRuntimeFactory { bootstrapFactories++; error("must not bootstrap") },
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
        val fixture = productionWorkflow({ paid }) { it.onReaderDisconnected() }
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
    ): WorkflowFixture {
        val fixture = WorkflowFixture()
        fixture.terminal.beforeConfirm = { beforeConfirm(fixture.runtime) }
        fixture.workflow = ProductionPreparedBridgeWorkflow(
            coordinator(fixture.prepared), fixture.queued,
            NativeCollectionRuntimeFactory { attempt ->
                assertEquals(AttemptMode.PREPARED, attempt.mode)
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
            PinnedReaderBootstrapRuntimeFactory {
                ReadyBootstrapRuntime(reader(fixture.ticket)) {
                    fixture.runtime.discover()
                    fixture.terminal.readers?.invoke(listOf(reader(fixture.ticket)))
                    fixture.runtime.selectReader(reader(fixture.ticket))
                    fixture.runtime.connectSelectedReader()
                    fixture.terminal.connected?.invoke()
                }
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

    private class WorkflowFixture {
        val ticket = AttemptTicket("ticket", 2_000L, "tmr_exact", Approved.LOCATION)
        val queued = QueuedExecutor()
        val prepared = RecordingPreparedApi(ticket)
        val terminal = RecordingTerminal()
        lateinit var runtime: NativeCollectionRuntime
        lateinit var workflow: ProductionPreparedBridgeWorkflow
    }
    private class QueuedExecutor : OperatorBackgroundExecutor {
        private val tasks = mutableListOf<() -> Unit>()
        override fun execute(task: () -> Unit) { tasks += task }
        fun runAll() { while (tasks.isNotEmpty()) tasks.removeAt(0).invoke() }
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
    private class RecordingPreparedApi(private val ticket: AttemptTicket) : PreparedPurchaseApi {
        val references = mutableListOf<String>()
        val paymentIds = mutableListOf<String?>()
        val recoveries = mutableListOf<String>()
        override fun preparedAttempt(session: StaffSession, preparedPurchaseReference: String): AttemptTicket = ticket.also { references += preparedPurchaseReference }
        override fun preparedPaymentIntent(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String?) =
            PaymentResult("pi_exact", "requires_payment_method", false, "secret_exact").also { paymentIds += paymentIntentId }
        override fun preparedRecover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
            PaymentResult("pi_exact", "succeeded", true).also { recoveries += paymentIntentId }
    }
    private class GrantedPermissions : BluetoothPermissions {
        override fun hasBluetoothPermissions() = true
        override fun requestBluetoothPermissions() = error("permission request")
    }
    private class ReadyBootstrapRuntime(
        private val reader: ConnectedReader,
        private val beforeReady: () -> Unit,
    ) : PinnedReaderBootstrapRuntime {
        override fun hasBluetoothPermission() = true
        override fun requestBluetoothPermission() = error("permission request")
        override fun discover(onReaders: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit) = onReaders(listOf(reader))
        override fun connect(reader: ConnectedReader, onConnected: (ConnectedReader) -> Unit, onDisconnected: () -> Unit, onFailure: () -> Unit) {
            beforeReady(); onConnected(reader)
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
