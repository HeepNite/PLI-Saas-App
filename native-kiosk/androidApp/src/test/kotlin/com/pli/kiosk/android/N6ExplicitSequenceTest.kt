package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class N6ExplicitSequenceTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session", "cookie", now + 120_000)

    @Test
    fun beginAttemptPersistsOnlyTheSignedTicketBeforeAnyPaymentIntent() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        val coordinator = PurchaseCoordinator(origin, store, api) { now }

        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
        assertEquals(Outcome.PENDING, coordinator.start())

        assertEquals(1, api.preflights)
        assertEquals(1, api.issued)
        assertEquals(0, api.prepares)
        assertEquals("ticket", store.state.attempt?.ticket?.value)
        assertEquals(null, store.state.attempt?.paymentIntentId)
        assertFalse(store.writes.any { it.attempt?.paymentIntentId != null })
    }

    @Test
    fun configuredRuntimeRequiresTicketThenRunsOneSameIdSdkSequenceAndServerRecovery() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply {
            prepared = PaymentResult("pi_same", "requires_payment_method", false, "secret_transient")
            refreshed = PaymentResult("pi_same", "succeeded", true)
        }
        var coordinator = PurchaseCoordinator(origin, store, api) { now }
        val terminal = SequenceTerminal()
        val reader = ConnectedReader("tmr_fixture", Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)
        val runtime = ProductionOperatorRuntime(
            native = null,
            selection = coordinator,
            startSource = { coordinator.startCollection() },
            nativeFactory = { issuedTicket ->
                NativeCollectionRuntime(
                    NativeCollectionConfiguration(origin.value, true), session, issuedTicket, terminal,
                    GrantedPermissions(), object : ConnectionTokenSource {
                        override fun connectionToken(session: StaffSession) = "token"
                    },
                    object : PaymentRecovery {
                        override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
                            RecoveryState.FromServer(PaymentResult(paymentIntentId, "succeeded", true))
                    },
                    { now },
                )
            },
            paidRollover = {
                assertEquals(Outcome.PAID, coordinator.recoverKnownAttempt())
                val paid = store.state
                store.write(DurableState(paid.session))
                coordinator = PurchaseCoordinator(origin, store, api) { now }
                SelfServiceRollover(coordinator) { coordinator.startCollection() }
            },
        )
        runtime.setStateListener {}

        assertFalse(runtime.readerDiscoveryEnabled)
        assertFalse(runCatching(runtime::discoverReaders).isSuccess)
        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
        assertTrue(runtime.attemptStartEnabled)
        runtime.beginAttempt()
        assertEquals(0, api.prepares)
        assertTrue(runtime.readerDiscoveryEnabled)
        assertFalse(runtime.discoveredReaders.joinToString().contains("ticket"))

        runtime.discoverReaders()
        runtime.selectReader(reader)
        assertTrue(runtime.readerConnectionEnabled)
        runtime.connectSelectedReader()
        assertTrue(runtime.collectionControlsEnabled)
        runtime.startCollection()

        assertEquals(listOf("retrieve:secret_transient", "collect:pi_same", "confirm:pi_same"), terminal.operations)
        assertTrue(store.writes.any { it.attempt?.paymentIntentId == "pi_same" })
        assertTrue(store.writes.none { it.toString().contains("secret_transient") })
        assertEquals(null, store.state.attempt)
        assertFalse(runtime.attemptStartEnabled)

        runtime.lookupStudent("+15550000001")
        runtime.confirmSelectedStudent()
        assertTrue(runtime.attemptStartEnabled)
        runtime.beginAttempt()
        assertEquals(2, api.issued)
        assertEquals(1, api.prepares)
    }

    @Test
    fun restartAtTicketOnlyAndKnownIdNeverIssuesAnotherTicketOrIntent() {
        val ticketOnlyStore = MemoryStore(DurableState(session))
        val ticketOnlyApi = Api()
        val ticketOnly = PurchaseCoordinator(origin, ticketOnlyStore, ticketOnlyApi) { now }
        ticketOnly.lookupStudent("+15550000000")
        ticketOnly.confirmSelectedStudent()
        ticketOnly.start()

        assertEquals(Outcome.PENDING, PurchaseCoordinator(origin, ticketOnlyStore, ticketOnlyApi) { now }.resume())
        assertEquals(1, ticketOnlyApi.issued)
        assertEquals(0, ticketOnlyApi.prepares)

        val knownStore = MemoryStore(DurableState(session, AttemptState(AttemptTicket("ticket", now + 60_000, "tmr_fixture", Approved.LOCATION), session.association, origin.value, "pi_same")))
        val knownApi = Api().apply { refreshed = PaymentResult("pi_same", "processing", false) }
        assertEquals(Outcome.PENDING, PurchaseCoordinator(origin, knownStore, knownApi) { now }.resume())
        assertEquals(0, knownApi.issued)
        assertEquals(0, knownApi.prepares)
        assertEquals(1, knownApi.recoveries)
    }

    private class GrantedPermissions : BluetoothPermissions {
        override fun hasBluetoothPermissions() = true
        override fun requestBluetoothPermissions() = Unit
    }

    private class SequenceTerminal : NativeTerminalAdapter {
        val operations = mutableListOf<String>()
        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable {
            onUpdate(listOf(ConnectedReader("tmr_fixture", Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)))
            return NativeCancelable {}
        }
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            onSuccess()
            return NativeCancelable {}
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "retrieve:$clientSecret"
            onSuccess("pi_same")
            return NativeCancelable {}
        }
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "collect:$paymentIntentId"
            onSuccess(paymentIntentId)
            return NativeCancelable {}
        }
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            operations += "confirm:$paymentIntentId"
            onSuccess(paymentIntentId)
            return NativeCancelable {}
        }
    }

    private class MemoryStore(var state: DurableState) : StateStore {
        val writes = mutableListOf<DurableState>()
        override fun read(): DurableState = state
        override fun write(state: DurableState) {
            writes += state
            this.state = state
        }
    }

    private class Api : PurchaseApi {
        var preflights = 0
        var issued = 0
        var prepares = 0
        var recoveries = 0
        var prepared = PaymentResult("pi_fixture", "requires_payment_method", false, "secret")
        var refreshed = PaymentResult("pi_fixture", "requires_payment_method", false, "secret_refresh")
        override fun lookup(session: StaffSession, phone: String) = StudentLookupResult.Unique(MinimumStudentIdentity("Fixture"))
        override fun preflight(session: StaffSession) { preflights++ }
        override fun issue(session: StaffSession, phone: String): AttemptTicket {
            issued++
            return AttemptTicket("ticket", 1_060_000, "tmr_fixture", Approved.LOCATION)
        }
        override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult {
            prepares++
            return prepared
        }
        override fun refreshCollection(session: StaffSession, ticket: AttemptTicket, id: String) = refreshed
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult {
            recoveries++
            return refreshed
        }
    }
}
