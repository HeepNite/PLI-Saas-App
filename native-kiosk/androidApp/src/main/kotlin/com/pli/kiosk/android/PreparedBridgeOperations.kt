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

/** Narrow construction seams; the workflow itself owns the concrete native orchestration. */
fun interface NativeCollectionRuntimeFactory { fun create(preparedAttempt: AttemptState): NativeCollectionRuntime }
fun interface PinnedReaderBootstrapRuntimeFactory { fun create(preparedAttempt: AttemptState): PinnedReaderBootstrapRuntime }

/**
 * Native-only prepared admission. This is deliberately not attached to a WebView host yet.
 * Every server call runs through [backgroundExecutor]; JS receives only coarse completion states.
 */
class ProductionPreparedBridgeWorkflow(
    private val coordinator: PurchaseCoordinator,
    private val backgroundExecutor: OperatorBackgroundExecutor,
    private val nativeRuntimeFactory: NativeCollectionRuntimeFactory,
    private val bootstrapRuntimeFactory: PinnedReaderBootstrapRuntimeFactory,
    private val provisionedReaderId: String,
    private val clock: () -> Long = System::currentTimeMillis,
) : PreparedBridgeWorkflow {
    override fun launch(operationReference: String, preparedPurchaseReference: String, completion: (PreparedRecoveryState) -> Unit) {
        val publication = Publication(completion)
        try {
            backgroundExecutor.execute {
                publication.publish(PreparedRecoveryState.PENDING)
                try {
                    require(coordinator.startPrepared(preparedPurchaseReference) == Outcome.PENDING)
                    val attempt = coordinator.retainedPreparedAttemptForNativeRuntime()
                    val runtime = nativeRuntimeFactory.create(attempt)
                    runtime.setStateListener { onRuntimeState(runtime, publication) }
                    runtime.initialize()
                    PinnedReaderBootstrap(
                        attempt, provisionedReaderId, bootstrapRuntimeFactory.create(attempt), clock,
                        onReady = {
                            try {
                                val start = coordinator.startCollection()
                                runtime.start(start.attempt, start.clientSecret)
                            } catch (_: Exception) {
                                publication.reject()
                            }
                        },
                        onRecoveryRequired = publication::reject,
                    ).start()
                } catch (_: Exception) {
                    publication.reject()
                }
            }
        } catch (_: Exception) {
            publication.reject()
        }
    }

    private fun onRuntimeState(runtime: NativeCollectionRuntime, publication: Publication) {
        try {
            when (runtime.state) {
                NativeCollectionState.PAID -> if (publication.claimPaidRecovery()) {
                    backgroundExecutor.execute {
                        try {
                            if (coordinator.recoverKnownAttempt() == Outcome.PAID) publication.publish(PreparedRecoveryState.PAID)
                            else publication.reject()
                        } catch (_: Exception) {
                            publication.reject()
                        }
                    }
                }
                NativeCollectionState.MANUAL_RECONCILIATION,
                NativeCollectionState.UNRESOLVED,
                NativeCollectionState.RECONNECT_REQUIRED -> publication.reject()
                else -> publication.publish(PreparedRecoveryState.PENDING)
            }
        } catch (_: Exception) {
            publication.reject()
        }
    }

    private class Publication(private val completion: (PreparedRecoveryState) -> Unit) {
        private var state: PreparedRecoveryState? = null
        private var paidRecoveryClaimed = false

        @Synchronized fun publish(next: PreparedRecoveryState) {
            if (state == PreparedRecoveryState.PAID || state == PreparedRecoveryState.REJECTED || state == next) return
            state = next
            completion(next)
        }
        @Synchronized fun reject() = publish(PreparedRecoveryState.REJECTED)
        @Synchronized fun claimPaidRecovery(): Boolean {
            if (state == PreparedRecoveryState.PAID || state == PreparedRecoveryState.REJECTED || paidRecoveryClaimed) return false
            paidRecoveryClaimed = true
            return true
        }
    }
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
        START to SecureBridgeOperation.withResponse(mapOf(PREPARED_PURCHASE_REFERENCE to PREPARED_REFERENCE_LENGTH)) { _, reference, fields ->
            startResult(reference, fields.getValue(PREPARED_PURCHASE_REFERENCE))
        },
        POLL to SecureBridgeOperation.withResponse(mapOf(OPERATION_REFERENCE to MAX_OPERATION_REFERENCE_LENGTH)) { _, _, fields ->
            pollResult(fields.getValue(OPERATION_REFERENCE))
        },
    )

    @Synchronized
    fun start(operationReference: String, preparedPurchaseReference: String) =
        startResult(operationReference, preparedPurchaseReference).state

    @Synchronized
    private fun startResult(operationReference: String, preparedPurchaseReference: String): SecureBridgeOperationResult {
        if (invalidated || !validOperationReference(operationReference) || !validPreparedReference(preparedPurchaseReference) ||
            operations.containsKey(operationReference) || operations.size >= capacity) return SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)
        val entry = Entry()
        operations[operationReference] = entry // Reserve before launching; synchronous callbacks may poll it.
        return try {
            workflow.launch(operationReference, preparedPurchaseReference) { completion -> complete(operationReference, entry, completion) }
            SecureBridgeOperationResult(operationReference, SecureBridgeState.PENDING)
        } catch (_: Exception) {
            entry.state = SecureBridgeState.REJECTED
            SecureBridgeOperationResult(operationReference, SecureBridgeState.REJECTED)
        }
    }

    @Synchronized
    fun poll(operationReference: String) = pollResult(operationReference).state

    @Synchronized
    private fun pollResult(operationReference: String) =
        if (invalidated || !validOperationReference(operationReference)) SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)
        else operations[operationReference]?.let { SecureBridgeOperationResult(operationReference, it.state) }
            ?: SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)

    @Synchronized
    fun invalidate() {
        invalidated = true
        operations.clear()
    }

    @Synchronized
    private fun complete(operationReference: String, entry: Entry, completion: PreparedRecoveryState) {
        if (!invalidated && operations[operationReference] === entry && entry.state == SecureBridgeState.PENDING) entry.state = when (completion) {
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
