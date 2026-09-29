package com.pli.kiosk.android

import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class FoundationTest {
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val now = 1_000_000L
    private val session = StaffSession(origin.value, "test-session", "a".repeat(43), now + 100_000)
    private val ticket = AttemptTicket("opaque-ticket", now + 60_000, "tmr_liveFixture", Approved.LOCATION)

    private class MemoryStore(var state: DurableState = DurableState()) : StateStore {
        var fail = false
        override fun read(): DurableState {
            if (fail) throw IOException("fixture")
            return state
        }
        override fun write(state: DurableState) {
            if (fail) throw IOException("fixture")
            this.state = state
        }
    }

    private inner class Api : PurchaseApi {
        var issued = 0
        val submissions = mutableListOf<String>()
        val recoveries = mutableListOf<String>()
        var result = PaymentResult("pi_fixture", "requires_payment_method", false, "secret_fixture")
        var onPrepare: () -> Unit = {}
        var failPrepare = false
        override fun lookup(session: StaffSession, phone: String): StudentLookupResult = StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student"))
        override fun preflight(session: StaffSession) = Unit
        override fun issue(session: StaffSession, phone: String): AttemptTicket { issued++; return ticket }
        override fun prepare(session: StaffSession, ticket: AttemptTicket): PaymentResult {
            submissions.add(ticket.value)
            onPrepare()
            if (failPrepare) throw IOException("offline")
            return result
        }
        override fun recover(session: StaffSession, ticket: AttemptTicket, id: String): PaymentResult {
            recoveries.add(id)
            return result
        }
    }

    private fun coordinator(store: StateStore, api: Api = Api(), time: Long = now) =
        PurchaseCoordinator(origin, store, api, { time })

    private fun selectAndConfirm(coordinator: PurchaseCoordinator) {
        coordinator.lookupStudent("+15550000000")
        coordinator.confirmSelectedStudent()
    }

    @Test fun ticketIsDurableBeforeExplicitCollectionPreparation() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        api.onPrepare = { assertEquals(ticket, store.state.attempt?.ticket) }
        val c = coordinator(store, api)
        selectAndConfirm(c)
        assertEquals(Outcome.PENDING, c.start())
        assertEquals(ticket, store.state.attempt?.ticket)
        assertNull(store.state.attempt?.paymentIntentId)
        assertTrue(api.submissions.isEmpty())
        c.startCollection()
        assertEquals("pi_fixture", store.state.attempt?.paymentIntentId)
        assertFalse(c.collectionEnabled)
    }

    @Test fun restartWithKnownIdOnlyRecoversEvenAfterExpiry() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        coordinator(store, api).also(::selectAndConfirm).also { it.start(); it.startCollection() }
        api.result = PaymentResult("pi_fixture", "succeeded", true)
        assertEquals(Outcome.PAID, coordinator(store, api, now + 70_000).resume())
        assertEquals(1, api.submissions.size)
        assertEquals(listOf("pi_fixture"), api.recoveries)
        assertEquals(1, api.issued)
        assertNotNull(store.state.attempt)
    }

    @Test fun unknownOutcomeReplaysOnlyRetainedTicket() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply { failPrepare = true }
        coordinator(store, api).also(::selectAndConfirm).let { it.start(); assertFails { it.startCollection() } }
        api.failPrepare = false
        coordinator(store, api).startCollection()
        assertEquals(listOf(ticket.value, ticket.value), api.submissions)
        assertEquals(1, api.issued)
    }

    @Test fun expiredUnknownCannotResumeOrReplace() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply { failPrepare = true }
        coordinator(store, api).also(::selectAndConfirm).let { it.start(); assertFails { it.startCollection() } }
        val restarted = coordinator(store, api, now + 70_000)
        assertEquals(Outcome.PENDING, restarted.resume())
        assertFails { restarted.startCollection() }
        assertEquals(Outcome.PENDING, restarted.start())
        assertEquals(1, api.issued)
        assertEquals(1, api.submissions.size)
    }

    @Test fun corruptionAndInitialWriteFailureBlockNetwork() {
        val store = MemoryStore(DurableState(session)).apply { fail = true }
        val api = Api()
        assertFails { coordinator(store, api).start() }
        assertEquals(0, api.issued)
    }

    @Test fun failedIdWritePoisonsInstanceAndRetainsReplayTicket() {
        val store = MemoryStore(DurableState(session))
        val api = Api().apply { onPrepare = { store.fail = true } }
        val c = coordinator(store, api)
        selectAndConfirm(c)
        c.start()
        assertFails { c.startCollection() }
        store.fail = false
        assertFails { c.resume() }
        assertNull(store.state.attempt?.paymentIntentId)
        assertEquals(ticket, store.state.attempt?.ticket)
        assertFalse(c.collectionEnabled)
    }

    @Test fun loginReplacesExpiredSessionOnlyWithoutAttempt() {
        val expired = session.copy(expiresAt = now)
        val replacement = session.copy(association = "replacement")
        val store = MemoryStore(DurableState(expired))
        assertEquals(replacement, coordinator(store).login { replacement })
        assertEquals(DurableState(replacement), store.state)

        val c = coordinator(store)
        selectAndConfirm(c)
        c.start()
        store.state = store.state.copy(session = expired)
        var logins = 0
        assertFails { coordinator(store).login { logins++; replacement } }
        assertEquals(0, logins)
        assertNotNull(store.state.attempt)
    }

    @Test fun missingOriginalSessionBlocksResumeAndLoginBeforeCallback() {
        val store = MemoryStore(DurableState(session))
        val c = coordinator(store)
        selectAndConfirm(c)
        c.start()
        store.state = store.state.copy(session = null)
        assertFails { coordinator(store).resume() }
        var logins = 0
        assertFails { coordinator(store).login { logins++; session } }
        assertEquals(0, logins)
        assertNotNull(store.state.attempt)
    }

    @Test fun missingOriginalSessionBlocksRecoveryAndLogin() {
        val store = MemoryStore(DurableState(session))
        val c = coordinator(store)
        selectAndConfirm(c)
        c.start()
        store.state = store.state.copy(session = null)
        var logins = 0
        assertFails { coordinator(store).resume() }
        assertFails { coordinator(store).login { logins++; session } }
        assertEquals(0, logins)
    }

    @Test fun changedOriginOrSessionBlocksRecovery() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        coordinator(store, api).also(::selectAndConfirm).start()
        store.state = store.state.copy(session = session.copy(association = "replacement"))
        assertFails { coordinator(store, api).resume() }
        store.state = store.state.copy(session = session.copy(origin = "https://other.invalid"))
        assertFails { coordinator(store, api).resume() }
        assertTrue(api.recoveries.isEmpty())
    }

    @Test fun sdkCallbacksNeverMarkPaidAndKnownIdMismatchFails() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        val c = coordinator(store, api)
        selectAndConfirm(c)
        c.start()
        c.startCollection()
        assertEquals(Outcome.DISABLED, c.sdkCompleted("stale", true))
        assertFalse(store.state.attempt!!.resolved)
        api.result = PaymentResult("pi_other", "succeeded", true)
        assertFails { c.resume() }
        assertFalse(store.state.attempt!!.resolved)
    }

    @Test fun simultaneousStartsIssueOnlyOneAttempt() {
        val store = MemoryStore(DurableState(session))
        val api = Api()
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        api.onPrepare = { entered.countDown(); assertTrue(release.await(5, TimeUnit.SECONDS)) }
        val c = coordinator(store, api)
        selectAndConfirm(c)
        c.start()
        val pool = Executors.newSingleThreadExecutor()
        try {
            val first = pool.submit<TransientCollectionStart> { c.startCollection() }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            assertTrue(runCatching { c.startCollection() }.isFailure)
            release.countDown()
            assertEquals("pi_fixture", first.get(5, TimeUnit.SECONDS).attempt.paymentIntentId)
            assertEquals(1, api.issued)
        } finally { release.countDown(); pool.shutdownNow() }
    }

    @Test fun approvedOriginRejectsMissingInsecureOrAmbiguousConfiguration() {
        listOf("", "http://approved.invalid", "https://x.invalid/path", "https://u:p@x.invalid",
            "https://x.invalid?query", "https://x.invalid#fragment", "https://x.invalid:444").forEach {
            assertFails { ApprovedOrigin(it) }
        }
    }

    @Test fun connectedReaderMustMatchEveryTicketAndPhysicalBinding() {
        val reader = ConnectedReader("tmr_liveFixture", "STRM2D533025669", "stripe_m2", Approved.LOCATION)
        assertTrue(ReaderPolicy.matches(reader, ticket, "tmr_liveFixture"))
        listOf(reader.copy(id = ""), reader.copy(id = "tmr_other"), reader.copy(serial = "wrong"),
            reader.copy(type = "chipper"), reader.copy(location = "tml_other")).forEach {
            assertFalse(ReaderPolicy.matches(it, ticket, "tmr_liveFixture"))
        }
        assertFalse(ReaderPolicy.matches(reader, ticket, null))
    }

    private fun config() = JSONObject().put("accountId", Approved.ACCOUNT)
        .put("productId", Approved.PRODUCT).put("priceId", Approved.PRICE)
        .put("locationId", Approved.LOCATION).put("amount", 100).put("currency", "usd")
        .put("paymentCreationEnabled", true).put("livemode", true)

    @Test fun parserRejectsCatalogAndModeOverridesAndInconsistentPaid() {
        Contract.preflight(config())
        listOf("accountId", "productId", "priceId", "locationId", "currency", "amount").forEach {
            assertFails { Contract.preflight(config().put(it, "wrong")) }
        }
        assertFails { Contract.preflight(config().put("livemode", false)) }
        assertFails { Contract.preflight(config().apply { remove("livemode") }) }
        assertFails { Contract.preflight(config().put("paymentCreationEnabled", false)) }
        assertFails { Contract.preflight(config().put("paymentCreationEnabled", "true")) }
        assertFails { Contract.payment(JSONObject("""{"id":"pi_fixture","status":"processing","paid":true}"""), false) }
        assertFails { Contract.payment(JSONObject("""{"id":"pi_fixture","status":"succeeded","paid":false}"""), false) }
        assertFails { Contract.payment(JSONObject("""{"id":"pi_fixture","status":"succeeded","paid":true,"clientSecret":"secret"}"""), true) }
    }
}
