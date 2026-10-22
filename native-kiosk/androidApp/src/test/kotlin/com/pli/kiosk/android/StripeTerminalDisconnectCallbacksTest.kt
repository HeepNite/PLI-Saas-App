package com.pli.kiosk.android

import kotlin.test.assertEquals
import org.junit.Test

class StripeTerminalDisconnectCallbacksTest {
    @Test
    fun `unexpected disconnect poisons warm owner and active reused operation exactly once`() {
        val calls = mutableListOf<String>()
        val callbacks = StripeTerminalDisconnectCallbacks()
        callbacks.bindPhysical { calls += "warm" }
        callbacks.bindReuse { calls += "operation" }

        callbacks.notifyDisconnected()
        callbacks.notifyDisconnected()

        assertEquals(listOf("warm", "operation"), calls)
    }

    @Test
    fun `new reuse replaces only the prior operation callback and preserves warm owner`() {
        val calls = mutableListOf<String>()
        val callbacks = StripeTerminalDisconnectCallbacks()
        callbacks.bindPhysical { calls += "warm" }
        callbacks.bindReuse { calls += "old-operation" }
        callbacks.bindReuse { calls += "new-operation" }

        callbacks.notifyDisconnected()

        assertEquals(listOf("warm", "new-operation"), calls)
    }

    @Test
    fun `explicit disconnect clears every callback before sdk completion`() {
        val calls = mutableListOf<String>()
        val callbacks = StripeTerminalDisconnectCallbacks()
        callbacks.bindPhysical { calls += "warm" }
        callbacks.bindReuse { calls += "operation" }

        callbacks.clear()
        callbacks.notifyDisconnected()

        assertEquals(emptyList(), calls)
    }
}
