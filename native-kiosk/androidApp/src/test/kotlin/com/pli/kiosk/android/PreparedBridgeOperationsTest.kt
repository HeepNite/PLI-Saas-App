package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PreparedBridgeOperationsTest {
    @Test
    fun startForwardsExactValidatedReferencesAndOnlyItsCompletionMayReportPaid() {
        lateinit var operations: PreparedBridgeOperations
        val preparedOne = preparedReference()
        val preparedTwo = preparedReference('B')
        val completions = mutableMapOf<String, (PreparedRecoveryState) -> Unit>()
        val workflow = PreparedBridgeWorkflow { operation, prepared, completion ->
            assertEquals(SecureBridgeState.PENDING, operations.poll(operation))
            assertEquals(if (operation == "opaque-one") preparedOne else preparedTwo, prepared)
            completions[operation] = completion
        }
        operations = PreparedBridgeOperations(workflow, capacity = 2)
        val bridge = bridge(operations)

        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"$preparedOne\"}")).state)
        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(request("two", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"$preparedTwo\"}")).state)
        completions.getValue("opaque-one")(PreparedRecoveryState.PAID)

        val paid = poll(bridge, "state-one", "opaque-one")
        assertTrue(paid.state == SecureBridgeState.PAID && paid.operationRef == "opaque-one" && paid.operationRef != "opaque-state-one")
        assertEquals(SecureBridgeState.PENDING, poll(bridge, "state-two", "opaque-two").state)
    }

    @Test
    fun collidingGeneratedReferencesRejectBeforeInsertionOrSecondLaunch() {
        var launches = 0
        var complete: ((PreparedRecoveryState) -> Unit)? = null
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, callback -> launches++; complete = callback }, capacity = 2)
        val bridge = SecureWebBridge(operations.bridgeOperations()) { _, _ -> "colliding-reference" }

        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}")).state)
        complete?.invoke(PreparedRecoveryState.PAID)
        assertEquals(SecureBridgeState.PAID, operations.poll("colliding-reference"))
        val rejected = bridge.dispatch(request("two", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference('B')}\"}"))
        assertTrue(rejected.state == SecureBridgeState.REJECTED && rejected.operationRef == null)
        assertEquals(SecureBridgeState.PAID, operations.poll("colliding-reference"))
        assertEquals(1, launches)
    }

    @Test
    fun startAndPollUseClosedSchemasAndDoNotExposeInput() {
        val bridge = bridge(PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> }))
        val secret = "provider-secret"
        val cases = listOf(
            request("missing", PreparedBridgeOperations.START, "{}"),
            request("extra", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\",\"extra\":\"x\"}"),
            request("poll-extra", PreparedBridgeOperations.POLL, "{\"operationReference\":\"opaque\",\"extra\":\"x\"}"),
            request("secret", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"$secret\"}"),
        )

        cases.forEach { response ->
            val reply = bridge.dispatch(response)
            assertTrue(reply.error == SecureBridgeError.INVALID_PAYLOAD || reply.state == SecureBridgeState.REJECTED)
            assertFalse(reply.toString().contains(secret))
            assertFalse(reply.operationRef?.contains(secret) == true)
        }
    }

    @Test
    fun duplicateStartIsCachedAndFullRegistryNeverEvictsUnresolvedOperations() {
        var launches = 0
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> launches++ }, capacity = 1)
        val bridge = bridge(operations)
        val first = request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}")

        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(first).state)
        assertEquals(SecureBridgeState.PENDING, bridge.dispatch(first).state)
        assertEquals(SecureBridgeState.REJECTED, bridge.dispatch(request("two", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference('B')}\"}")).state)
        assertEquals(1, launches)
    }

    @Test
    fun unknownCrossContextAndStaleReferencesRejectWithoutDiagnostics() {
        val first = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> })
        val second = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, _ -> })
        val bridge = bridge(first)
        val response = bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}"))
        val reference = requireNotNull(response.operationRef)

        val unknown = poll(bridge, "unknown", "opaque-unknown")
        assertTrue(unknown.state == SecureBridgeState.REJECTED && unknown.operationRef == null)
        val crossContext = poll(bridge(second), "cross-context", reference)
        assertTrue(crossContext.state == SecureBridgeState.REJECTED && crossContext.operationRef == null)
        first.invalidate()
        val stale = poll(bridge, "stale", reference)
        assertTrue(stale.state == SecureBridgeState.REJECTED && stale.operationRef == null)
        assertFalse(stale.toString().contains(reference))
    }

    @Test
    fun lateCompletionAfterInvalidationCannotResurrectOperation() {
        var complete: ((PreparedRecoveryState) -> Unit)? = null
        val operations = PreparedBridgeOperations(PreparedBridgeWorkflow { _, _, callback -> complete = callback })
        val bridge = bridge(operations)
        bridge.dispatch(request("one", PreparedBridgeOperations.START, "{\"preparedPurchaseReference\":\"${preparedReference()}\"}"))

        operations.invalidate()
        complete?.invoke(PreparedRecoveryState.PAID)

        assertTrue(operations.poll("opaque-one") == SecureBridgeState.REJECTED)
    }

    private fun bridge(operations: PreparedBridgeOperations) = SecureWebBridge(operations.bridgeOperations()) { requestId, _ -> "opaque-$requestId" }
    private fun poll(bridge: SecureWebBridge, requestId: String, reference: String) =
        bridge.dispatch(request(requestId, PreparedBridgeOperations.POLL, "{\"operationReference\":\"$reference\"}"))
    private fun preparedReference(first: Char = 'A') = first + "A".repeat(42)
    private fun request(id: String, operation: String, payload: String) =
        "{\"version\":1,\"operation\":\"$operation\",\"requestId\":\"$id\",\"payload\":$payload}"
}
