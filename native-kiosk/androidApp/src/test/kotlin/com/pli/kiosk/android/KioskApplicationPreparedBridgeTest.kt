package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class KioskApplicationPreparedBridgeTest {
    private val origin = "https://approved.invalid"
    private val admission = requireNotNull(SecureWebAdmission.from(origin))

    @Test
    fun disabledOrMismatchedConfigurationFailsClosedBeforeWorkflowConstruction() {
        listOf(
            NativeCollectionConfiguration(origin, false) to admission,
            NativeCollectionConfiguration("https://other.invalid", true) to admission,
        ).forEach { (configuration, requestedAdmission) ->
            var workflows = 0

            val context = KioskApplication().preparePreparedBridgeContext(
                configuration, requestedAdmission, workflowFactory = {
                    workflows++
                    error("disabled or foreign context must not construct a workflow")
                },
            )

            assertNull(context)
            assertEquals(0, workflows)
        }
    }

    @Test
    fun exactEnabledConfigurationCreatesBridgeAndRetainsItsLifecycleOwner() {
        val lifecycle = RecordingWorkflow()
        val context = requireNotNull(KioskApplication().preparePreparedBridgeContext(
            enabled(), admission, workflowFactory = { lifecycle },
        ))

        assertNotNull(context.bridge)
        assertTrue(context.lifecycleOwner === context.operations)
        context.lifecycleOwner.onSessionInvalidated()
        assertEquals(1, lifecycle.sessionInvalidations)
    }

    @Test
    fun duplicateGeneratedOperationReferencesFailClosedWithoutLaunchingTwice() {
        val workflow = RecordingWorkflow()
        val context = requireNotNull(KioskApplication().preparePreparedBridgeContext(
            enabled(), admission, { workflow }, operationReferenceGenerator = { "A".repeat(43) },
        ))

        val first = context.bridge.dispatch(start("one", preparedReference()))
        val duplicate = context.bridge.dispatch(start("two", preparedReference('B')))

        assertEquals(SecureBridgeState.PENDING, first.state)
        assertEquals(SecureBridgeState.REJECTED, duplicate.state)
        assertNull(duplicate.operationRef)
        assertEquals(1, workflow.launches)
    }

    @Test
    fun generatedOperationReferencesAreOpaqueUrlSafeMaterial() {
        val requestId = "request-derived-text"
        val operation = PreparedBridgeOperations.START
        val reference = newPreparedBridgeOperationReference()

        assertEquals(43, reference.length)
        assertTrue(reference.all { it.isLetterOrDigit() || it == '-' || it == '_' })
        assertFalse(reference.contains(requestId))
        assertFalse(reference.contains(operation))
    }

    private fun enabled() = NativeCollectionConfiguration(origin, true)
    private fun preparedReference(first: Char = 'A') = first + "A".repeat(42)
    private fun start(requestId: String, reference: String) =
        "{\"version\":1,\"operation\":\"${PreparedBridgeOperations.START}\",\"requestId\":\"$requestId\",\"payload\":{\"preparedPurchaseReference\":\"$reference\"}}"

    private class RecordingWorkflow : PreparedBridgeWorkflow, PreparedBridgeLifecycle {
        var launches = 0
        var sessionInvalidations = 0
        override fun launch(operationReference: String, preparedPurchaseReference: String, completion: (PreparedRecoveryState) -> Unit) { launches++ }
        override fun onBluetoothPermissionResult(granted: Boolean) = Unit
        override fun onApplicationBackgrounded() = Unit
        override fun onSessionInvalidated() { sessionInvalidations++ }
        override fun onReaderInvalidated() = Unit
    }
}
