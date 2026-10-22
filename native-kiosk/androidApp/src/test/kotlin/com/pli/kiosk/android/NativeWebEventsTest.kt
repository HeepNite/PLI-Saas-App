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
}
