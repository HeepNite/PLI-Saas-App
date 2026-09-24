package com.pli.kiosk.android

import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class StudentSelectionTest {
    private val now = 1_000_000L
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val session = StaffSession(origin.value, "session-fixture", "cookie-fixture", now + 100_000L)
    private val ticket = AttemptTicket("signed-recipient-binding-fixture", now + 60_000L, "tmr_fixture", Approved.LOCATION)

    @Test
    fun missingInvalidAndAmbiguousLookupsCannotBeConfirmedOrAttempted() {
        listOf(StudentLookupResult.Missing, StudentLookupResult.Invalid, StudentLookupResult.Ambiguous).forEach { result ->
            val store = MemoryStore(DurableState(session))
            val api = Api().apply { lookupResult = result }
            val coordinator = coordinator(store, api)

            assertEquals(result, coordinator.lookupStudent("+15550000000"))
            assertFailsWith<IllegalArgumentException> { coordinator.confirmSelectedStudent() }
            assertFailsWith<IllegalArgumentException> { coordinator.start() }
            assertEquals(emptyList(), api.issuedPhones)
        }
    }

    @Test
    fun aUniqueMinimumIdentityMustBeExplicitlyConfirmedBeforeAttemptUsesOnlyItsPhone() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply {
            lookupResult = StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student"))
        }
        val coordinator = coordinator(store, api)

        assertIs<StudentLookupResult.Unique>(coordinator.lookupStudent("+15550000000"))
        assertEquals(MinimumStudentIdentity("Fixture student"), coordinator.confirmSelectedStudent())
        assertEquals(Outcome.PENDING, coordinator.start())

        assertEquals(listOf("+15550000000"), api.issuedPhones)
        assertEquals(ticket, store.state.attempt?.ticket)
        assertNull(coordinator.selectedStudent)
    }

    @Test
    fun aNewLookupReplacesAnEarlierConfirmationBeforeAttemptAndRequiresNewConfirmation() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply {
            lookupResult = StudentLookupResult.Unique(MinimumStudentIdentity("First fixture"))
        }
        val coordinator = coordinator(store, api)
        coordinator.lookupStudent("+15550000001")
        coordinator.confirmSelectedStudent()

        api.lookupResult = StudentLookupResult.Unique(MinimumStudentIdentity("Second fixture"))
        coordinator.lookupStudent("+15550000002")

        assertFailsWith<IllegalArgumentException> { coordinator.start() }
        assertEquals(MinimumStudentIdentity("Second fixture"), coordinator.confirmSelectedStudent())
        assertEquals(Outcome.PENDING, coordinator.start())
        assertEquals(listOf("+15550000002"), api.issuedPhones)
    }

    @Test
    fun selectionCannotChangeAfterAttemptAndRestartRecoversTheSameSignedRecipientBinding() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply {
            lookupResult = StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student"))
        }
        val coordinator = coordinator(store, api)
        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
        coordinator.start()
        coordinator.startCollection()

        assertFailsWith<IllegalArgumentException> { coordinator.lookupStudent("+15550000002") }
        api.result = PaymentResult("pi_fixture", "succeeded", true)
        assertEquals(Outcome.PAID, coordinator(store, api).resume())
        assertEquals(ticket, store.state.attempt?.ticket)
        assertEquals(listOf("+15550000000"), api.issuedPhones)
        assertEquals(listOf("pi_fixture"), api.recoveries)
    }

    @Test
    fun durableSnapshotContainsOnlyTheOpaqueSignedBindingAndNeverMinimumIdentityOrPhone() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply {
            lookupResult = StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student"))
        }
        val coordinator = coordinator(store, api)
        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
        coordinator.start()

        val snapshot = requireNotNull(store.state.attempt)
        assertEquals(ticket, snapshot.ticket)
        assertFalse(snapshot.toString().contains("Fixture student"))
        assertFalse(snapshot.toString().contains("+15550000000"))
    }

    private fun coordinator(store: StateStore, api: Api) = PurchaseCoordinator(origin, store, api) { now }

    private class MemoryStore(var state: DurableState) : StateStore {
        override fun read(): DurableState = state
        override fun write(state: DurableState) { this.state = state }
    }

    private class Api : PurchaseApi {
        var lookupResult: StudentLookupResult = StudentLookupResult.Invalid
        val issuedPhones = mutableListOf<String>()
        val recoveries = mutableListOf<String>()
        var result = PaymentResult("pi_fixture", "requires_payment_method", false, "secret_fixture")

        override fun lookup(session: StaffSession, phone: String): StudentLookupResult = lookupResult
        override fun preflight(session: StaffSession) = Unit
        override fun issue(session: StaffSession, phone: String): AttemptTicket {
            issuedPhones += phone
            return AttemptTicket("signed-recipient-binding-fixture", 1_060_000L, "tmr_fixture", Approved.LOCATION)
        }
        override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult = result
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult {
            recoveries += id
            return result
        }
    }
}
