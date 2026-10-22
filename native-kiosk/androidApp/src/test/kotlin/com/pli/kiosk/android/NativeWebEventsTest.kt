package com.pli.kiosk.android

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

class NativeWebEventsTest {
    @Test
    fun `reader status uses the closed event schema and is pushed only on change`() {
        val events = NativeWebEvents()
        val posted = mutableListOf<String>()
        events.bind { posted += it }

        events.readerStatus(ReaderStatus.CONNECTING)
        events.readerStatus(ReaderStatus.CONNECTING)
        events.readerStatus(ReaderStatus.CONNECTED)
        events.readerStatus(ReaderStatus.DISCONNECTED)

        assertEquals(
            listOf(
                """{"version":1,"event":"readerStatus","payload":{"status":"connecting"}}""",
                """{"version":1,"event":"readerStatus","payload":{"status":"connected"}}""",
                """{"version":1,"event":"readerStatus","payload":{"status":"disconnected"}}""",
            ),
            posted,
        )
    }

    @Test
    fun `collection prompts use the closed event schema and are pushed only on change`() {
        val events = NativeWebEvents()
        val posted = mutableListOf<String>()
        events.bind { posted += it }

        events.collectionPrompt(CollectionPrompt.AWAITING_CARD)
        events.collectionPrompt(CollectionPrompt.AWAITING_CARD)
        events.collectionPrompt(CollectionPrompt.PROCESSING)
        events.collectionPrompt(CollectionPrompt.NONE)

        assertEquals(
            listOf(
                """{"version":1,"event":"collectionPrompt","payload":{"prompt":"awaiting_card"}}""",
                """{"version":1,"event":"collectionPrompt","payload":{"prompt":"processing"}}""",
                """{"version":1,"event":"collectionPrompt","payload":{"prompt":"none"}}""",
            ),
            posted,
        )
    }

    @Test
    fun `a status request is answered with the current status once a page target is bound`() {
        val events = NativeWebEvents()
        events.readerStatus(ReaderStatus.CONNECTED)
        val posted = mutableListOf<String>()

        events.requestStatus()
        events.bind { posted += it }
        events.bind { posted += it }

        assertEquals(listOf("""{"version":1,"event":"readerStatus","payload":{"status":"connected"}}"""), posted)
    }

    @Test
    fun `nothing is pushed before a page binds or after invalidation`() {
        val events = NativeWebEvents()
        val posted = mutableListOf<String>()

        events.readerStatus(ReaderStatus.CONNECTING)
        events.bind { posted += it }
        events.invalidate()
        events.readerStatus(ReaderStatus.CONNECTED)
        events.collectionPrompt(CollectionPrompt.AWAITING_CARD)
        events.requestStatus()
        events.bind { posted += it }

        assertTrue(posted.isEmpty())
    }

    @Test
    fun `a failing page target never breaks the native caller`() {
        val events = NativeWebEvents()
        events.bind { error("webview gone") }

        events.readerStatus(ReaderStatus.CONNECTED)
        events.collectionPrompt(CollectionPrompt.PROCESSING)
    }
    @Test
    fun `unbinding a target clears only that exact binding`() {
        val events = NativeWebEvents()
        val older = mutableListOf<String>()
        val newer = mutableListOf<String>()
        val olderTarget = NativeWebEventTarget { older += it }
        val newerTarget = NativeWebEventTarget { newer += it }

        events.bind(olderTarget)
        events.bind(newerTarget)
        events.unbind(olderTarget)
        events.readerStatus(ReaderStatus.CONNECTED)
        events.unbind(newerTarget)
        events.readerStatus(ReaderStatus.DISCONNECTED)

        assertTrue(older.isEmpty())
        assertEquals(listOf("""{"version":1,"event":"readerStatus","payload":{"status":"connected"}}"""), newer)
    }

    @Test
    fun `after host invalidation reader status and collection prompts never reach the old page`() {
        val events = NativeWebEvents()
        val queue = ArrayDeque<Runnable>()
        val delivered = mutableListOf<Pair<String, String>>()
        val target = HostBoundWebEventTarget<String>(events, queue::addLast) { proxy, message -> delivered += proxy to message }

        target.bindProxy("page-a")
        target.invalidate()
        events.readerStatus(ReaderStatus.DISCONNECTED)
        events.collectionPrompt(CollectionPrompt.AWAITING_CARD)
        target.bindProxy("page-a")
        events.readerStatus(ReaderStatus.CONNECTED)
        while (queue.isNotEmpty()) queue.removeFirst().run()

        assertTrue(delivered.isEmpty())
    }

    @Test
    fun `a push scheduled before host invalidation but executed after it is dropped`() {
        val events = NativeWebEvents()
        val queue = ArrayDeque<Runnable>()
        val delivered = mutableListOf<String>()
        val target = HostBoundWebEventTarget<String>(events, queue::addLast) { _, message -> delivered += message }

        target.bindProxy("page-a")
        events.readerStatus(ReaderStatus.DISCONNECTED)
        events.collectionPrompt(CollectionPrompt.PROCESSING)
        target.invalidate()
        while (queue.isNotEmpty()) queue.removeFirst().run()

        assertTrue(delivered.isEmpty())
    }

    @Test
    fun `an older host invalidation never clears a newer host binding`() {
        val events = NativeWebEvents()
        val queue = ArrayDeque<Runnable>()
        val delivered = mutableListOf<Pair<String, String>>()
        val older = HostBoundWebEventTarget<String>(events, queue::addLast) { proxy, message -> delivered += proxy to message }
        val newer = HostBoundWebEventTarget<String>(events, queue::addLast) { proxy, message -> delivered += proxy to message }

        older.bindProxy("old-page")
        newer.bindProxy("new-page")
        older.invalidate()
        events.readerStatus(ReaderStatus.CONNECTED)
        while (queue.isNotEmpty()) queue.removeFirst().run()

        assertEquals(
            listOf("new-page" to """{"version":1,"event":"readerStatus","payload":{"status":"connected"}}"""),
            delivered,
        )
    }

    @Test
    fun `a host target delivers on its scheduler to the latest admitted page`() {
        val events = NativeWebEvents()
        val queue = ArrayDeque<Runnable>()
        val delivered = mutableListOf<Pair<String, String>>()
        val target = HostBoundWebEventTarget<String>(events, queue::addLast) { proxy, message -> delivered += proxy to message }

        target.bindProxy("page-a")
        target.bindProxy("page-b")
        events.collectionPrompt(CollectionPrompt.AWAITING_CARD)
        assertTrue(delivered.isEmpty())
        while (queue.isNotEmpty()) queue.removeFirst().run()

        assertEquals(
            listOf("page-b" to """{"version":1,"event":"collectionPrompt","payload":{"prompt":"awaiting_card"}}"""),
            delivered,
        )
    }
}
