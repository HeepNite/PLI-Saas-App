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
    fun adapterDispatchesOnlyAdmittedMessagesAndRepliesWithClosedRequestEnvelope() {
        var calls = 0
        var state = SecureBridgeState.ACCEPTED
        val bridge = SecureWebBridge(mapOf("startPreparedPurchase" to SecureBridgeOperation(emptyMap()) {
            calls++
            state
        })) { _, _ -> "opaque-ref" }
        val adapter = SecureWebMessageAdapter(requireNotNull(SecureWebAdmission.from(origin)), bridge)
        val request = "{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"id\\\"<\",\"payload\":{}}"

        assertEquals("{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"id\\\"<\",\"payload\":{\"operationReference\":\"opaque-ref\",\"state\":\"accepted\"}}", adapter.handle(origin, true, terminal, request))
        state = SecureBridgeState.REJECTED
        val rejectedRequest = "{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"id-2\",\"payload\":{}}"
        assertEquals("{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"id-2\",\"payload\":{\"operationReference\":\"opaque-ref\",\"state\":\"rejected\"}}", adapter.handle(origin, true, terminal, rejectedRequest))
        val escapedOperationRequest = "{\"version\":1,\"operation\":\"startPreparedPur\\u0063hase\",\"requestId\":\"id-escaped\",\"payload\":{}}"
        assertEquals("{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"id-escaped\",\"payload\":{\"operationReference\":\"opaque-ref\",\"state\":\"rejected\"}}", adapter.handle(origin, true, terminal, escapedOperationRequest))
        assertNull(adapter.handle(origin, true, terminal, "bad"))
        state = SecureBridgeState.PAID
        val paidRequest = "{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"id-3\",\"payload\":{}}"
        assertNull(adapter.handle(origin, true, terminal, paidRequest))
        assertNull(adapter.handle("https://foreign.invalid", true, terminal, request))
        assertEquals(4, calls)

        adapter.invalidate()
        assertNull(adapter.handle(origin, true, terminal, request))
        assertEquals(4, calls)
    }

    @Test
    fun adapterProjectsAuthoritativePaidOnlyForTheExactOwnedPreparedStatePoll() {
        lateinit var completion: (PreparedRecoveryState) -> Unit
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, callback -> completion = callback })
        val bridge = SecureWebBridge(operations.bridgeOperations()) { requestId, _ -> "opaque-$requestId" }
        val adapter = SecureWebMessageAdapter(requireNotNull(SecureWebAdmission.from(origin)), bridge)
        val preparedReference = "A".repeat(43)
        val start = "{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"start\",\"payload\":{\"preparedPurchaseReference\":\"$preparedReference\"}}"
        val poll = "{\"version\":1,\"operation\":\"getPreparedPurchaseState\",\"requestId\":\"poll\",\"payload\":{\"operationReference\":\"opaque-start\"}}"

        assertEquals("{\"version\":1,\"operation\":\"startPreparedPurchase\",\"requestId\":\"start\",\"payload\":{\"operationReference\":\"opaque-start\",\"state\":\"pending\"}}", adapter.handle(origin, true, terminal, start))
        completion(PreparedRecoveryState.PAID)
        assertEquals("{\"version\":1,\"operation\":\"getPreparedPurchaseState\",\"requestId\":\"poll\",\"payload\":{\"operationReference\":\"opaque-start\",\"state\":\"paid\"}}", adapter.handle(origin, true, terminal, poll))
        assertNull(adapter.handle(origin, true, terminal, "{\"version\":1,\"operation\":\"getPreparedPurchaseState\",\"requestId\":\"unknown\",\"payload\":{\"operationReference\":\"opaque-unknown\"}}"))
    }

    @Test
    fun diagnosticRoundTripTraversesOnlyTheAdmittedHostAndDispatcherPath() {
        var launches = 0
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> launches++ })
        val bridge = SecureWebBridge(operations.bridgeOperations()) { requestId, _ -> "opaque-$requestId" }
        val adapter = SecureWebMessageAdapter(requireNotNull(SecureWebAdmission.from(origin)), bridge)
        val request = "{\"version\":1,\"operation\":\"diagnosticRoundTrip\",\"requestId\":\"diagnostic\",\"payload\":{}}"

        assertEquals("{\"version\":1,\"operation\":\"diagnosticRoundTrip\",\"requestId\":\"diagnostic\",\"payload\":{\"operationReference\":\"opaque-diagnostic\",\"state\":\"accepted\"}}", adapter.handle(origin, true, terminal, request))
        assertNull(adapter.handle("https://foreign.invalid", true, terminal, request))
        assertNull(adapter.handle(origin, false, terminal, request))
        assertEquals(0, launches)
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
