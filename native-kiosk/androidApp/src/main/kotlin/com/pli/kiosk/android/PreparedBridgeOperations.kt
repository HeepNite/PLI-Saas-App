package com.pli.kiosk.android

/** Only fresh server-authoritative prepared recovery may supply [PAID]. */
enum class PreparedRecoveryState { PENDING, PAID, REJECTED }

/**
 * Starts asynchronous prepared recovery. Its completion is a server-recovery seam, never an SDK or
 * local callback; [PreparedRecoveryState.PAID] therefore requires a fresh authoritative result.
 */
fun interface PreparedBridgeWorkflow {
    fun launch(
        operationReference: String,
        preparedPurchaseReference: String,
        completion: (PreparedRecoveryState) -> Unit,
    )
}

/**
 * Bounded, synchronized ownership registry for one bridge context. It stores only opaque operation
 * references and coarse state; invalidation poisons every captured completion callback.
 */
class PreparedBridgeOperations(
    private val workflow: PreparedBridgeWorkflow,
    private val capacity: Int = DEFAULT_CAPACITY,
) {
    private val operations = mutableMapOf<String, Entry>()
    private var invalidated = false

    init {
        require(capacity > 0)
    }

    fun bridgeOperations(): Map<String, SecureBridgeOperation> = mapOf(
        START to SecureBridgeOperation(mapOf(PREPARED_PURCHASE_REFERENCE to PREPARED_REFERENCE_LENGTH)) { _, reference, fields ->
            start(reference, fields.getValue(PREPARED_PURCHASE_REFERENCE))
        },
        POLL to SecureBridgeOperation(mapOf(OPERATION_REFERENCE to MAX_OPERATION_REFERENCE_LENGTH)) { _, _, fields ->
            poll(fields.getValue(OPERATION_REFERENCE))
        },
    )

    @Synchronized
    fun start(operationReference: String, preparedPurchaseReference: String): SecureBridgeState {
        if (invalidated || !validOperationReference(operationReference) || !validPreparedReference(preparedPurchaseReference)) {
            return SecureBridgeState.REJECTED
        }
        if (operations.containsKey(operationReference) || operations.size >= capacity) return SecureBridgeState.REJECTED
        val entry = Entry()
        operations[operationReference] = entry // Reserve before launching; synchronous callbacks may poll it.
        return try {
            workflow.launch(operationReference, preparedPurchaseReference) { completion -> complete(operationReference, entry, completion) }
            SecureBridgeState.PENDING
        } catch (_: Exception) {
            entry.state = SecureBridgeState.REJECTED
            SecureBridgeState.REJECTED
        }
    }

    @Synchronized
    fun poll(operationReference: String): SecureBridgeState =
        if (invalidated || !validOperationReference(operationReference)) SecureBridgeState.REJECTED
        else operations[operationReference]?.state ?: SecureBridgeState.REJECTED

    @Synchronized
    fun invalidate() {
        invalidated = true
        operations.clear()
    }

    @Synchronized
    private fun complete(operationReference: String, entry: Entry, completion: PreparedRecoveryState) {
        if (!invalidated && operations[operationReference] === entry) entry.state = when (completion) {
            PreparedRecoveryState.PENDING -> SecureBridgeState.PENDING
            PreparedRecoveryState.PAID -> SecureBridgeState.PAID
            PreparedRecoveryState.REJECTED -> SecureBridgeState.REJECTED
        }
    }

    private fun validPreparedReference(value: String) =
        value.length == PREPARED_REFERENCE_LENGTH && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }

    private fun validOperationReference(value: String) =
        value.isNotBlank() && value.length <= MAX_OPERATION_REFERENCE_LENGTH

    private class Entry(var state: SecureBridgeState = SecureBridgeState.PENDING)

    companion object {
        const val START = "startPreparedPurchase"
        const val POLL = "getPreparedPurchaseState"
        const val PREPARED_PURCHASE_REFERENCE = "preparedPurchaseReference"
        const val OPERATION_REFERENCE = "operationReference"
        private const val PREPARED_REFERENCE_LENGTH = 43
        private const val MAX_OPERATION_REFERENCE_LENGTH = 128
        private const val DEFAULT_CAPACITY = 32
    }
}
