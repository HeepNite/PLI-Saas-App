package com.pli.kiosk.android

import org.junit.Test
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WebSessionReadinessTest {
    private val origin = ApprovedOrigin("https://approved.invalid")
    private val terminal = "${origin.value}/staff/terminal"
    private val cookie = "pli_terminal_session=browser-session"

    @Test
    fun deniedOrForeignCompletionNeverReadsCookies() {
        val store = MemoryStore()
        var reads = 0
        val readiness = readiness(store) { reads++; cookie }

        assertFalse(readiness.capture("https://foreign.invalid/staff/terminal", terminal))
        assertFalse(readiness.capture(terminal, "$terminal?redirect"))
        assertEquals(0, reads)
        assertNull(store.state.session)
    }

    @Test
    fun exactCompletionWithMissingOrMalformedCookieIsNotReadyAndLeaksNothing() {
        listOf<String?>(null, "pli_terminal_session=\"quoted\"").forEach { header ->
            val store = MemoryStore()
            val readiness = readiness(store) { header }

            assertFalse(readiness.capture(terminal, terminal))
            assertNull(store.state.session)
            assertEquals(0, store.writes)
        }
    }

    @Test
    fun validCookiePersistsAndReadsBackBeforeReadiness() {
        val store = MemoryStore()
        val readiness = readiness(store) { cookie }

        assertTrue(readiness.capture(terminal, terminal))
        assertTrue(readiness.ready)
        assertEquals(1, store.writes)
        assertEquals(origin.value, store.state.session?.origin)
        assertNull(store.state.attempt)
    }

    @Test
    fun duplicateCookieCompletionRetainsFreshMatchingSessionWithoutExtendingItsTtl() {
        val clock = MutableClock(1_000_000L)
        val store = MemoryStore()
        val readiness = readiness(store, clock) { cookie }

        assertTrue(readiness.capture(terminal, terminal))
        val originalExpiry = requireNotNull(store.state.session).expiresAt
        clock.advanceBy(60_000L)

        assertTrue(readiness.capture(terminal, terminal))
        assertEquals(1, store.writes)
        assertEquals(originalExpiry, store.state.session?.expiresAt)
        assertTrue(readiness.ready)
    }

    @Test
    fun expiredOrChangedCookieSessionIsGuardedlyReplacedButAttemptsBlockAllReplacement() {
        val clock = MutableClock(1_000_000L)
        val store = MemoryStore()
        var browserCookie = cookie
        val readiness = readiness(store, clock) { browserCookie }

        assertTrue(readiness.capture(terminal, terminal))
        clock.advanceBy(15 * 60_000L)
        assertTrue(readiness.capture(terminal, terminal))
        assertEquals(2, store.writes)

        browserCookie = "pli_terminal_session=replacement-session"
        assertTrue(readiness.capture(terminal, terminal))
        assertEquals(3, store.writes)

        store.state = store.state.copy(attempt = AttemptState(null, "association", origin.value))
        assertFalse(readiness.capture(terminal, terminal))
        assertEquals(3, store.writes)
    }

    @Test
    fun retainedAttemptCorruptStateAndWriteOrReadbackFailureBlockReplacement() {
        listOf(
            MemoryStore(DurableState(attempt = AttemptState(null, "association", origin.value))),
            MemoryStore(DurableState(attempt = AttemptState(null, "association", origin.value, "pi_retained", true))),
            MemoryStore(failRead = true),
            MemoryStore(failWrite = true),
            MemoryStore(readbackMismatch = true),
        ).forEach { store ->
            var reads = 0
            val readiness = readiness(store) { reads++; cookie }

            assertFalse(readiness.capture(terminal, terminal))
            assertFalse(readiness.ready)
            if (store.state.attempt != null || store.failRead) assertEquals(0, reads)
        }
    }

    private fun readiness(
        store: MemoryStore,
        clock: MutableClock = MutableClock(1_000_000L),
        readCookie: () -> String?,
    ): WebSessionReadiness =
        WebSessionReadiness(origin, store, StaffSessionTransport(origin) { clock.now }, BrowserCookieReader { readCookie() }) { clock.now }

    private class MutableClock(var now: Long) {
        fun advanceBy(millis: Long) {
            now += millis
        }
    }

    private class MemoryStore(
        var state: DurableState = DurableState(),
        val failRead: Boolean = false,
        val failWrite: Boolean = false,
        val readbackMismatch: Boolean = false,
    ) : StateStore {
        var writes = 0
        private var wrote = false
        override fun read(): DurableState {
            if (failRead) throw IOException("fixture unavailable")
            return if (readbackMismatch && wrote) DurableState() else state
        }
        override fun write(state: DurableState) {
            if (failWrite) throw IOException("fixture write failure")
            writes++
            wrote = true
            this.state = state
        }
    }
}
