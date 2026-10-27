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
fun interface PinnedReaderBootstrapRuntimeFactory {
    fun create(preparedAttempt: AttemptState, runtime: NativeCollectionRuntime): PinnedReaderBootstrapRuntime
}

/** Lifecycle routing seam for a prepared workflow; the bridge registry remains its only host owner. */
interface PreparedBridgeLifecycle {
    fun onBluetoothPermissionResult(granted: Boolean)
    fun onApplicationBackgrounded()
    fun onSessionInvalidated()
    fun onReaderInvalidated()
    /** The web stopped watching this sale; a reader still waiting for a card must stop accepting one. */
    fun onWebAbandoned(operationReference: String, reason: WebAbandonReason) = Unit
}

/** Why the native side concluded that no web document is watching a sale anymore. */
enum class WebAbandonReason(val wire: String) { POLL_TIMEOUT("poll_timeout"), DOCUMENT_RETIRED("document_retired") }

/**
 * Native-only prepared admission. Each launch owns its runtime, bootstrap, and state subscription
 * here, rather than relying on mutable factory captures or process-global routing.
 */
class ProductionPreparedBridgeWorkflow(
    private val coordinator: PurchaseCoordinator,
    private val backgroundExecutor: OperatorBackgroundExecutor,
    private val nativeRuntimeFactory: NativeCollectionRuntimeFactory,
    private val bootstrapRuntimeFactory: PinnedReaderBootstrapRuntimeFactory,
    private val provisionedReaderId: String,
    private val clock: () -> Long = System::currentTimeMillis,
    private val bootstrapDeadlineScheduler: CollectionDeadlineScheduler = NoopCollectionDeadlineScheduler,
    private val beforeSaleDiscovery: () -> Unit = {},
    private val onCollectionPrompt: (CollectionPrompt) -> Unit = {},
    private val renewSession: () -> Boolean = { true },
) : PreparedBridgeWorkflow, PreparedBridgeLifecycle {
    private val handles = mutableMapOf<String, Handle>()

    override fun launch(operationReference: String, preparedPurchaseReference: String, completion: (PreparedRecoveryState) -> Unit) {
        lateinit var handle: Handle
        val publication = Publication(completion) { terminal -> close(handle, terminal) }
        handle = Handle(operationReference, publication)
        synchronized(this) { handles[operationReference] = handle }
        try {
            backgroundExecutor.execute {
                try {
                    if (!active(handle)) return@execute
                publication.publish(PreparedRecoveryState.PENDING)
                try {
                    // The browser capture is locally bounded; renew it from the same WebView cookie first.
                    val renewed = try { renewSession() } catch (_: Exception) { false }
                    if (!renewed) PliM2Diagnostics.log("sale session renewal refused")
                    try {
                        require(withActive(handle) { coordinator.startPrepared(preparedPurchaseReference) } == Outcome.PENDING)
                    } catch (failure: Exception) {
                        PliM2Diagnostics.log("sale admission rejected reason=${coordinator.preparedAdmissionBlocker()}")
                        throw failure
                    }
                    if (!active(handle)) return@execute
                    val attempt = coordinator.retainedPreparedAttemptForNativeRuntime()
                    val runtime = nativeRuntimeFactory.create(attempt)
                    attachRuntime(handle, runtime)
                    if (!active(handle)) return@execute
                    val subscription = runtime.observeState {
                        try {
                            onRuntimeState(handle, runtime)
                        } catch (failure: TerminalCompletionFailure) {
                            throw failure.original
                        }
                    }
                    attachSubscription(handle, subscription)
                    runtime.initialize()
                    if (!active(handle)) return@execute
                    val bootstrap = PinnedReaderBootstrap(
                        attempt, provisionedReaderId, bootstrapRuntimeFactory.create(attempt, runtime), clock,
                        onReady = {
                            try {
                                withActive(handle) {
                                    // A sale nobody watches must never open the reader for a card.
                                    if (handle.abandoned) return@withActive
                                    val start = coordinator.startCollection()
                                    if (active(handle)) runtime.start(start.attempt, start.clientSecret)
                                }
                            } catch (failure: Exception) { publication.rejectUnlessTerminalCompletionFailure(failure) }
                        },
                        onRecoveryRequired = publication::reject,
                        deadlineScheduler = bootstrapDeadlineScheduler,
                    )
                    attachBootstrap(handle, bootstrap)
                    if (active(handle)) {
                        try { beforeSaleDiscovery() } catch (_: Exception) { Unit }
                        bootstrap.start()
                    }
                    publication.rethrowTerminalCompletionFailure()
                } catch (failure: Exception) { publication.rejectUnlessTerminalCompletionFailure(failure) }
                } catch (failure: TerminalCompletionFailure) {
                    throw failure.original
                }
            }
        } catch (failure: Exception) { publication.rejectUnlessTerminalCompletionFailure(failure) }
    }

    override fun onBluetoothPermissionResult(granted: Boolean) = unwrapTerminalCompletionFailure {
        activeHandles().forEach { handle ->
            handle.bootstrap?.takeIf { it.state == PinnedReaderBootstrap.State.PERMISSION_REQUIRED }
                ?.onBluetoothPermissionResult(granted)
            handle.publication.rethrowTerminalCompletionFailure()
        }
    }
    override fun onApplicationBackgrounded() = unwrapTerminalCompletionFailure { invalidateHandles { it.onApplicationBackgrounded() } }
    override fun onSessionInvalidated() = unwrapTerminalCompletionFailure { invalidateHandles { it.onSessionInvalidated() } }
    override fun onReaderInvalidated() = unwrapTerminalCompletionFailure { invalidateHandles { it.onReaderInvalidated() } }

    /**
     * Only a reader still waiting for the card is canceled; it then settles through the same not-paid
     * path as the collection deadline. Once the card was read, the paid/recovery path must finish.
     */
    override fun onWebAbandoned(operationReference: String, reason: WebAbandonReason) = unwrapTerminalCompletionFailure {
        val (handle, runtime) = synchronized(this) {
            val handle = handles[operationReference]?.takeUnless { it.closed } ?: return@unwrapTerminalCompletionFailure
            // Under the lock shared with collection start: either the attempt exists now or it never starts.
            handle.abandoned = true
            handle to handle.runtime
        }
        val action = when {
            runtime?.cancelWhileAwaitingCard() == true -> "cancel"
            runtime?.hasActiveAttempt == true -> "keep"
            else -> "reject"
        }
        PliM2Diagnostics.log("sale abandoned by web reason=${reason.wire} action=$action")
        if (action == "reject") handle.publication.reject()
        handle.publication.rethrowTerminalCompletionFailure()
    }

    private fun onRuntimeState(handle: Handle, runtime: NativeCollectionRuntime) {
        if (!active(handle)) return
        // The card was read: show processing until the sale publishes its terminal result.
        if (runtime.state == NativeCollectionState.CONFIRMING) prompt(CollectionPrompt.PROCESSING)
        when (runtime.state) {
            NativeCollectionState.PAID -> if (handle.publication.claimPaidRecovery()) {
                try {
                    backgroundExecutor.execute {
                        try {
                            if (!active(handle)) return@execute
                            val recovered = try {
                                withActive(handle) {
                                    coordinator.recoverKnownAttempt().also { outcome ->
                                        if (outcome == Outcome.PAID) {
                                            coordinator.clearResolvedPreparedAttempt()
                                            PliM2Diagnostics.log("retained attempt cleared reason=paid")
                                        }
                                    }
                                }
                            } catch (_: Exception) {
                                handle.publication.reject()
                                return@execute
                            }
                            if (recovered == Outcome.PAID && active(handle)) handle.publication.publish(PreparedRecoveryState.PAID)
                            else handle.publication.reject()
                        } catch (failure: TerminalCompletionFailure) {
                            throw failure.original
                        }
                    }
                } catch (failure: Exception) { handle.publication.rejectUnlessTerminalCompletionFailure(failure) }
            }
            NativeCollectionState.MANUAL_RECONCILIATION,
            NativeCollectionState.UNRESOLVED,
            NativeCollectionState.RECONNECT_REQUIRED -> when {
                // No PaymentIntent was ever collected by this runtime: nothing to cancel.
                !runtime.hasActiveAttempt -> handle.publication.reject()
                handle.publication.claimSettlement() -> settleNotPaid(handle)
            }
            else -> handle.publication.publish(PreparedRecoveryState.PENDING)
        }
    }

    /**
     * A sale that ended not paid frees the kiosk only when the server confirms Stripe canceled its
     * PaymentIntent uncharged. The web result is published after the durable clear, so the next
     * sale cannot race it. Ambiguous answers and failures keep the attempt retained (fail closed).
     */
    private fun settleNotPaid(handle: Handle) {
        try {
            backgroundExecutor.execute {
                try {
                    if (!active(handle)) return@execute
                    val settled = try {
                        withActive(handle) {
                            coordinator.cancelUnpaidPreparedAttempt().also { outcome ->
                                if (outcome == PreparedCancelOutcome.PAID) {
                                    coordinator.clearResolvedPreparedAttempt()
                                    PliM2Diagnostics.log("retained attempt cleared reason=paid")
                                }
                            }
                        }
                    } catch (_: Exception) {
                        null
                    }
                    PliM2Diagnostics.log("prepared cancel outcome=${settled?.name ?: "ERROR"}")
                    if (settled == PreparedCancelOutcome.CANCELED) PliM2Diagnostics.log("retained attempt cleared reason=canceled")
                    if (settled == PreparedCancelOutcome.PAID && active(handle)) handle.publication.publish(PreparedRecoveryState.PAID)
                    else handle.publication.reject()
                } catch (failure: TerminalCompletionFailure) {
                    throw failure.original
                }
            }
        } catch (failure: Exception) { handle.publication.rejectUnlessTerminalCompletionFailure(failure) }
    }

    private fun prompt(next: CollectionPrompt) {
        try { onCollectionPrompt(next) } catch (_: Exception) { Unit }
    }

    private fun invalidateHandles(invalidateRuntime: (NativeCollectionRuntime) -> Unit) = activeHandles().forEach { handle ->
        prompt(CollectionPrompt.NONE)
        val resources = synchronized(this) {
            if (handles[handle.reference] !== handle) null else {
                handles.remove(handle.reference)
                handle.closed = true
                Resources(handle.subscription, handle.bootstrap, handle.runtime)
            }
        } ?: return@forEach
        resources.subscription?.unsubscribe()
        handle.publication.reject()
        resources.bootstrap?.invalidate()
        resources.runtime?.let(invalidateRuntime)
    }

    private inline fun unwrapTerminalCompletionFailure(action: () -> Unit) {
        try {
            action()
        } catch (failure: TerminalCompletionFailure) {
            throw failure.original
        }
    }
    private fun activeHandles() = synchronized(this) { handles.values.toList() }
    private fun active(handle: Handle) = synchronized(this) { handles[handle.reference] === handle && !handle.closed }
    private inline fun <T> withActive(handle: Handle, action: () -> T): T? = synchronized(this) {
        if (handles[handle.reference] === handle && !handle.closed) action() else null
    }
    private fun attachRuntime(handle: Handle, runtime: NativeCollectionRuntime) = synchronized(this) {
        if (active(handle)) handle.runtime = runtime
    }
    private fun attachBootstrap(handle: Handle, bootstrap: PinnedReaderBootstrap) = synchronized(this) {
        if (active(handle)) handle.bootstrap = bootstrap else bootstrap.invalidate()
    }
    private fun attachSubscription(handle: Handle, subscription: NativeStateSubscription) = synchronized(this) {
        if (active(handle)) handle.subscription = subscription else subscription.unsubscribe()
    }
    private fun close(handle: Handle, terminal: PreparedRecoveryState) {
        prompt(CollectionPrompt.NONE)
        val resources = synchronized(this) {
            if (handles[handle.reference] !== handle) null else {
                handles.remove(handle.reference); handle.closed = true
                Resources(handle.subscription, handle.bootstrap, handle.runtime)
            }
        } ?: return
        resources.subscription?.unsubscribe()
        if (terminal != PreparedRecoveryState.REJECTED) return
        // A rejected sale must not leave its discovery or connection running orphaned. Once a
        // PaymentIntent exists, the runtime's own recovery remains the only authority.
        resources.bootstrap?.invalidate()
        resources.runtime?.takeUnless { it.hasActiveAttempt }?.onReaderInvalidated()
    }

    private class Handle(val reference: String, val publication: Publication) {
        var runtime: NativeCollectionRuntime? = null
        var bootstrap: PinnedReaderBootstrap? = null
        var subscription: NativeStateSubscription? = null
        var closed = false
        var abandoned = false
    }
    private data class Resources(
        val subscription: NativeStateSubscription?, val bootstrap: PinnedReaderBootstrap?, val runtime: NativeCollectionRuntime?,
    )
    private class TerminalCompletionFailure(val original: Throwable) : Error(original)
    private class Publication(
        private val completion: (PreparedRecoveryState) -> Unit,
        private val onTerminal: (PreparedRecoveryState) -> Unit,
    ) {
        private var state: PreparedRecoveryState? = null
        private val deliveries = mutableListOf<PreparedRecoveryState>()
        private var deliveryInProgress = false
        private var paidRecoveryClaimed = false
        private var settlementClaimed = false
        private var terminalCompletionFailure: Throwable? = null
        fun publish(next: PreparedRecoveryState) {
            val drain = synchronized(this) {
                if (state == PreparedRecoveryState.PAID || state == PreparedRecoveryState.REJECTED || state == next) false
                else {
                    state = next
                    deliveries += next
                    if (deliveryInProgress) false else { deliveryInProgress = true; true }
                }
            }
            if (drain) drainDeliveries()
        }
        private fun drainDeliveries() {
            try {
                while (true) {
                    val next = synchronized(this) { if (deliveries.isEmpty()) null else deliveries.removeAt(0) } ?: return
                    if (next != PreparedRecoveryState.PENDING) onTerminal(next)
                    try {
                        completion(next)
                    } catch (failure: Throwable) {
                        if (next != PreparedRecoveryState.PENDING) {
                            synchronized(this) { terminalCompletionFailure = failure }
                            throw TerminalCompletionFailure(failure)
                        }
                        throw failure
                    }
                }
            } finally {
                val resume = synchronized(this) {
                    if (deliveries.isEmpty()) { deliveryInProgress = false; false } else true
                }
                if (resume) drainDeliveries()
            }
        }
        fun rethrowTerminalCompletionFailure() {
            synchronized(this) { terminalCompletionFailure }?.let { throw it }
        }
        fun rejectUnlessTerminalCompletionFailure(failure: Throwable) {
            if (synchronized(this) { terminalCompletionFailure === failure }) throw failure
            reject()
        }
        fun reject() = publish(PreparedRecoveryState.REJECTED)
        @Synchronized fun claimSettlement(): Boolean {
            val available = state != PreparedRecoveryState.PAID && state != PreparedRecoveryState.REJECTED &&
                !paidRecoveryClaimed && !settlementClaimed
            if (available) settlementClaimed = true
            return available
        }
        @Synchronized fun claimPaidRecovery(): Boolean {
            val available = state != PreparedRecoveryState.PAID && state != PreparedRecoveryState.REJECTED && !paidRecoveryClaimed
            if (available) paidRecoveryClaimed = true
            return available
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
    private val clock: () -> Long = System::currentTimeMillis,
    private val livenessScheduler: CollectionDeadlineScheduler = NoopCollectionDeadlineScheduler,
    private val livenessWindowMs: Long = WEB_LIVENESS_WINDOW_MS,
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
        DIAGNOSTIC to SecureBridgeOperation(emptyMap()) { SecureBridgeState.ACCEPTED },
    )

    @Synchronized
    fun start(operationReference: String, preparedPurchaseReference: String) =
        startResult(operationReference, preparedPurchaseReference).state

    @Synchronized
    private fun startResult(operationReference: String, preparedPurchaseReference: String): SecureBridgeOperationResult {
        if (invalidated || !validOperationReference(operationReference) || !validPreparedReference(preparedPurchaseReference) ||
            operations.containsKey(operationReference)) return SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)
        operations.entries.removeAll { it.value.state != SecureBridgeState.PENDING }
        if (operations.size >= capacity) return SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)
        val entry = Entry()
        operations[operationReference] = entry // Reserve before launching; synchronous callbacks may poll it.
        return try {
            workflow.launch(operationReference, preparedPurchaseReference) { completion -> complete(operationReference, entry, completion) }
            if (entry.state == SecureBridgeState.PENDING) {
                entry.lastSeenAt = clock()
                scheduleLivenessCheck(operationReference, entry, livenessWindowMs)
            }
            SecureBridgeOperationResult(operationReference, SecureBridgeState.PENDING)
        } catch (_: Exception) {
            entry.state = SecureBridgeState.REJECTED
            SecureBridgeOperationResult(operationReference, SecureBridgeState.REJECTED)
        }
    }

    /** A sale is in flight; its page must not be replaced without invalidating it. */
    @Synchronized
    fun hasPendingOperation() = operations.values.any { it.state == SecureBridgeState.PENDING }

    @Synchronized
    fun poll(operationReference: String) = pollResult(operationReference).state

    @Synchronized
    private fun pollResult(operationReference: String) =
        if (invalidated || !validOperationReference(operationReference)) SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)
        else operations[operationReference]?.let { entry ->
            if (entry.state == SecureBridgeState.PENDING) entry.lastSeenAt = clock()
            SecureBridgeOperationResult(operationReference, entry.state)
        }
            ?: SecureBridgeOperationResult(null, SecureBridgeState.REJECTED)

    @Synchronized
    fun invalidate() {
        invalidated = true
        operations.values.forEach { it.cancelWatchdog() }
        operations.clear()
    }

    /** The page that started these sales is gone; none of them can still be watched. */
    fun onDocumentRetired() {
        val abandoned = synchronized(this) {
            if (invalidated) emptyList() else operations.filter { (_, entry) -> entry.claimAbandonment() }.keys.toList()
        }
        abandoned.forEach { abandon(it, WebAbandonReason.DOCUMENT_RETIRED) }
    }

    private fun scheduleLivenessCheck(operationReference: String, entry: Entry, delayMs: Long) {
        entry.watchdog = livenessScheduler.schedule(delayMs) { checkLiveness(operationReference, entry) }
    }

    private fun checkLiveness(operationReference: String, entry: Entry) {
        val abandoned = synchronized(this) {
            if (invalidated || operations[operationReference] !== entry || entry.state != SecureBridgeState.PENDING) return
            val silentFor = clock() - entry.lastSeenAt
            if (silentFor < livenessWindowMs) {
                scheduleLivenessCheck(operationReference, entry, livenessWindowMs - silentFor)
                false
            } else entry.claimAbandonment()
        }
        if (abandoned) abandon(operationReference, WebAbandonReason.POLL_TIMEOUT)
    }

    private fun abandon(operationReference: String, reason: WebAbandonReason) {
        try {
            (workflow as? PreparedBridgeLifecycle)?.onWebAbandoned(operationReference, reason)
        } catch (_: Exception) { Unit }
    }

    fun onBluetoothPermissionResult(granted: Boolean) = (workflow as? PreparedBridgeLifecycle)?.onBluetoothPermissionResult(granted) ?: Unit
    fun onApplicationBackgrounded() { invalidate(); (workflow as? PreparedBridgeLifecycle)?.onApplicationBackgrounded() }
    fun onSessionInvalidated() { invalidate(); (workflow as? PreparedBridgeLifecycle)?.onSessionInvalidated() }
    fun onReaderInvalidated() { invalidate(); (workflow as? PreparedBridgeLifecycle)?.onReaderInvalidated() }

    @Synchronized
    private fun complete(operationReference: String, entry: Entry, completion: PreparedRecoveryState) {
        if (!invalidated && operations[operationReference] === entry && entry.state == SecureBridgeState.PENDING) entry.state = when (completion) {
            PreparedRecoveryState.PENDING -> SecureBridgeState.PENDING
            PreparedRecoveryState.PAID -> SecureBridgeState.PAID
            PreparedRecoveryState.REJECTED -> SecureBridgeState.REJECTED
        }.also { if (it != SecureBridgeState.PENDING) entry.cancelWatchdog() }
    }

    private fun validPreparedReference(value: String) =
        value.length == PREPARED_REFERENCE_LENGTH && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }

    private fun validOperationReference(value: String) =
        value.isNotBlank() && value.length <= MAX_OPERATION_REFERENCE_LENGTH

    private class Entry(var state: SecureBridgeState = SecureBridgeState.PENDING) {
        var lastSeenAt = 0L
        var watchdog: NativeCancelable? = null
        private var abandoned = false
        /** One abandonment per sale; a terminal or already abandoned sale has nothing left to stop. */
        fun claimAbandonment(): Boolean {
            if (abandoned || state != SecureBridgeState.PENDING) return false
            abandoned = true
            cancelWatchdog()
            return true
        }
        fun cancelWatchdog() {
            try { watchdog?.cancel() } catch (_: Exception) { Unit }
            watchdog = null
        }
    }

    companion object {
        const val START = "startPreparedPurchase"
        const val POLL = "getPreparedPurchaseState"
        const val DIAGNOSTIC = "diagnosticRoundTrip"
        const val PREPARED_PURCHASE_REFERENCE = "preparedPurchaseReference"
        const val OPERATION_REFERENCE = "operationReference"
        private const val PREPARED_REFERENCE_LENGTH = 43
        private const val MAX_OPERATION_REFERENCE_LENGTH = 128
        private const val DEFAULT_CAPACITY = 32
        /**
         * The web polls every 500 ms and abandons a reply after 5 s, so a watching page is never silent
         * for more than ~5.5 s. Twice the web's own timeout tolerates main-thread jank yet still stops
         * the reader long before the 90 s collection deadline.
         */
        const val WEB_LIVENESS_WINDOW_MS = 10_000L
    }
}
