package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class N6ProductionTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session", "cookie", now + 100_000)
    private val ticket = AttemptTicket("ticket", now + 60_000, "tmr_fixture", Approved.LOCATION)

    @Test fun newCollectionStartPersistsIdBeforeReturningTransientSecret() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply { prepared = PaymentResult("pi_new", "requires_payment_method", false, "secret_new") }
        val coordinator = PurchaseCoordinator(origin, store, api, { now })
        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
        coordinator.start()

        val start = coordinator.startCollection()

        assertEquals(DurableAttempt(ticket, "pi_new"), start.attempt)
        assertEquals("secret_new", start.clientSecret)
        assertEquals("pi_new", store.state.attempt?.paymentIntentId)
        assertTrue(store.writes.any { it.attempt?.paymentIntentId == "pi_new" })
        assertFalse(store.writes.joinToString().contains("secret_new"))
    }

    @Test fun retainedKnownIdRefreshesSameTicketAndIdWithoutReplacement() {
        val store = MemoryStore(DurableState(session, AttemptState(ticket, session.association, origin.value, "pi_known")))
        val api = Api().apply { refreshed = PaymentResult("pi_known", "requires_payment_method", false, "secret_refresh") }
        val coordinator = PurchaseCoordinator(origin, store, api, { now })

        val start = coordinator.startCollection()

        assertEquals(DurableAttempt(ticket, "pi_known"), start.attempt)
        assertEquals(listOf(ticket.value to "pi_known"), api.refreshes)
        assertEquals(0, api.issued)
        assertEquals(0, api.prepares)
        assertEquals(0, api.recoveries)
    }

    @Test fun productionStartSourceExistsOnlyForConfiguredCoordinatorContext() {
        val store = MemoryStore(DurableState(session, AttemptState(ticket, session.association, origin.value, "pi_known")))
        val api = Api().apply { refreshed = PaymentResult("pi_known", "requires_payment_method", false, "secret_refresh") }
        val coordinator = PurchaseCoordinator(origin, store, api, { now })
        val terminal = Terminal()
        val runtime = KioskApplication().composeRuntime(
            NativeCollectionConfiguration(origin.value, true), session, ticket, terminal, Permissions(),
            object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" },
            object : PaymentRecovery {
                override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
                    RecoveryState.FromServer(PaymentResult(paymentIntentId, "processing", false))
            },
            coordinator, { now },
        )

        assertFalse(runtime.collectionControlsEnabled)
        runtime.discoverReaders()
        val reader = ConnectedReader(ticket.readerId, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)
        runtime.selectReader(reader)
        runtime.connectSelectedReader()
        assertTrue(runtime.collectionControlsEnabled)
        runtime.startCollection()

        assertEquals(listOf(ticket.value to "pi_known"), api.refreshes)
        assertEquals(listOf("secret_refresh"), terminal.secrets)
    }

    @Test fun missingIdPaidOrSecretCollectionRefreshFailsClosed() {
        listOf(
            PaymentResult("", "requires_payment_method", false, "secret"),
            PaymentResult("pi_known", "succeeded", true, "secret"),
            PaymentResult("pi_known", "requires_payment_method", false, null),
        ).forEach { payment ->
            val store = MemoryStore(DurableState(session, AttemptState(ticket, session.association, origin.value, "pi_known")))
            val api = Api().apply { refreshed = payment }

            assertFailsWith<IllegalArgumentException> { PurchaseCoordinator(origin, store, api, { now }).startCollection() }
            assertEquals("pi_known", store.state.attempt?.paymentIntentId)
            assertEquals(0, api.issued)
            assertEquals(0, api.prepares)
        }
    }

    private class Permissions : BluetoothPermissions {
        override fun hasBluetoothPermissions() = true
        override fun requestBluetoothPermissions() = Unit
    }

    private class Terminal : NativeTerminalAdapter {
        val secrets = mutableListOf<String>()
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
            secrets += clientSecret
            return NativeCancelable {}
        }
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NativeCancelable {}
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) = NativeCancelable {}
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
        var issued = 0
        var prepares = 0
        var recoveries = 0
        val refreshes = mutableListOf<Pair<String, String>>()
        var prepared = PaymentResult("pi_new", "requires_payment_method", false, "secret_new")
        var refreshed = PaymentResult("pi_known", "requires_payment_method", false, "secret_refresh")
        override fun lookup(session: StaffSession, phone: String) = StudentLookupResult.Unique(MinimumStudentIdentity("Fixture"))
        override fun preflight(session: StaffSession) = Unit
        override fun issue(session: StaffSession, phone: String): AttemptTicket {
            issued++
            return AttemptTicket("ticket", 1_060_000L, "tmr_fixture", Approved.LOCATION)
        }
        override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult { prepares++; return prepared }
        override fun refreshCollection(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult {
            refreshes += ticket.value to id
            return refreshed
        }
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult { recoveries++; return refreshed }
    }
}
