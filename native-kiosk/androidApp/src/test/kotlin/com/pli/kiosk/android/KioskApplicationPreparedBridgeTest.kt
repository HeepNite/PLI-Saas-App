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
        context.lifecycleOwner.onSessionInvalidated()
        assertEquals(1, lifecycle.sessionInvalidations)
    }

    @Test
    fun warmReaderStartsAfterPermissionOwnerAndSharesEveryTerminalLifecycleEdge() {
        val events = mutableListOf<String>()
        val warm = RecordingWarmReader(events)
        val context = requireNotNull(KioskApplication().preparePreparedBridgeContext(
            enabled(), admission,
            workflowFactory = { RecordingWorkflow() },
            permissionOwner = { events += "permission-owner" },
            warmReader = warm,
        ))

        context.attachPermissionOwner(android.app.Activity())
        context.lifecycleOwner.onBluetoothPermissionResult(true)
        context.lifecycleOwner.onApplicationBackgrounded()
        context.lifecycleOwner.onSessionInvalidated()
        context.lifecycleOwner.onReaderInvalidated()

        assertEquals(
            listOf("permission-owner", "warm-start", "warm-permission:true", "warm-invalidate"),
            events,
        )
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

    private class RecordingWarmReader(private val events: MutableList<String>) : WarmReaderLifecycle {
        private var invalidated = false
        override fun start() { events += "warm-start" }
        override fun onBluetoothPermissionResult(granted: Boolean) { events += "warm-permission:$granted" }
        override fun invalidate() {
            if (!invalidated) {
                invalidated = true
                events += "warm-invalidate"
            }
        }
    }

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
