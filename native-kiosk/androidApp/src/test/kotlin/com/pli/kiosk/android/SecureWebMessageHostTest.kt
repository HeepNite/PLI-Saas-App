package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SecureWebMessageHostTest {
    private val origin = "https://approved.invalid"
    private val terminal = "$origin/staff/terminal"

    @Test
    fun originRequiresOneExactHttpsOriginAndTerminalTarget() {
        val policy = requireNotNull(SecureWebAdmission.from(origin))
        assertEquals(terminal, policy.terminalUrl)
        listOf("", "not a URL", "http://approved.invalid", "$origin/other", "$origin?query", "$origin#fragment", "https://user@approved.invalid", "https://approved.invalid:444").forEach {
            assertNull(SecureWebAdmission.from(it))
        }
    }

    @Test
    fun navigationAndMessagesRequireTheExactMainFrameTarget() {
        val policy = requireNotNull(SecureWebAdmission.from(origin))
        assertTrue(policy.allowsMainFrameNavigation(terminal, isRedirect = false))
        assertFalse(policy.allowsMainFrameNavigation(terminal, isRedirect = true))
        listOf("$terminal/", "$terminal?next=1", "$terminal#payment", "$origin/staff", "https://foreign.invalid/staff/terminal").forEach {
            assertFalse(policy.allowsMainFrameNavigation(it, isRedirect = false))
        }
        assertTrue(policy.acceptsMessage(origin, true, terminal))
        assertFalse(policy.acceptsMessage("https://foreign.invalid", true, terminal))
        assertFalse(policy.acceptsMessage(origin, false, terminal))
        assertFalse(policy.acceptsMessage(origin, true, "$terminal#payment"))
    }

    @Test
    fun navigationOverridesOnlyDeniedMainFrames() {
        val policy = requireNotNull(SecureWebAdmission.from(origin))
        assertFalse(policy.shouldOverrideNavigation(terminal, false, false))
        assertFalse(policy.shouldOverrideNavigation("https://foreign.invalid/staff/terminal", false, false))
        assertFalse(policy.shouldOverrideNavigation(terminal, false, true))
        assertTrue(policy.shouldOverrideNavigation(terminal, true, true))
        assertTrue(policy.shouldOverrideNavigation("https://foreign.invalid/staff/terminal", false, true))
    }

    @Test
    fun adapterDispatchesOnlyAdmittedMessagesAndRepliesWithRedactedJson() {
        var calls = 0
        val bridge = SecureWebBridge(mapOf("collect" to SecureBridgeOperation(emptyMap()) {
            calls++
            SecureBridgeState.ACCEPTED
        })) { _, _ -> "opaque-ref" }
        val adapter = SecureWebMessageAdapter(requireNotNull(SecureWebAdmission.from(origin)), bridge)
        val request = "{\"version\":1,\"operation\":\"collect\",\"requestId\":\"id\\\"<\",\"payload\":{}}"

        assertEquals("{\"requestId\":\"id\\\"<\",\"operationRef\":\"opaque-ref\",\"state\":\"accepted\"}", adapter.handle(origin, true, terminal, request))
        assertEquals("{\"requestId\":null,\"error\":\"malformed_request\"}", adapter.handle(origin, true, terminal, "bad"))
        assertNull(adapter.handle("https://foreign.invalid", true, terminal, request))
        assertEquals(1, calls)

        adapter.invalidate()
        assertNull(adapter.handle(origin, true, terminal, request))
        assertEquals(1, calls)
    }

    @Test
    fun bridgeAdmissionRequiresEveryHostGate() {
        val policy = requireNotNull(SecureWebAdmission.from(origin))
        assertEquals("pliNativeBridge", SecureWebMessageHost.OBJECT_NAME)
        val bridge = SecureWebBridge(emptyMap()) { _, _ -> "opaque" }
        assertTrue(SecureWebMessageHost.canAttach(policy, true, true, bridge))
        assertFalse(SecureWebMessageHost.canAttach(policy, false, true, bridge))
        assertFalse(SecureWebMessageHost.canAttach(policy, true, false, bridge))
        assertFalse(SecureWebMessageHost.canAttach(policy, true, true, null))
    }
}
