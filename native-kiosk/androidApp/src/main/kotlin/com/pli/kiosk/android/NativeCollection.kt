package com.pli.kiosk.android

/** Build-time inputs only. The blank default intentionally makes the installed default fail closed. */
data class NativeCollectionConfiguration(val approvedOrigin: String, val collectionEnabled: Boolean) {
    init {
        if (collectionEnabled) ApprovedOrigin(approvedOrigin)
        else if (approvedOrigin.isNotBlank()) ApprovedOrigin(approvedOrigin)
    }
    companion object {
        fun fromBuildConfig() = NativeCollectionConfiguration(BuildConfig.APPROVED_HTTPS_ORIGIN, BuildConfig.NATIVE_COLLECTION_ENABLED)
    }
}

interface BluetoothPermissions {
    fun hasBluetoothPermissions(): Boolean
    /** The UI owns the Android permission prompt; this method must never start discovery. */
    fun requestBluetoothPermissions()
}
object BluetoothPermissionRequest { const val CODE = 801 }
internal fun requiredBluetoothPermissions(sdk: Int): Array<String> = if (sdk >= 31) {
    arrayOf(android.Manifest.permission.BLUETOOTH_SCAN, android.Manifest.permission.BLUETOOTH_CONNECT)
} else {
    arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION)
}
class AndroidBluetoothPermissions(private var activity: android.app.Activity? = null) : BluetoothPermissions {
    fun attach(activity: android.app.Activity) { this.activity = activity }
    override fun hasBluetoothPermissions(): Boolean {
        val owner = activity ?: return false
        return requiredBluetoothPermissions(android.os.Build.VERSION.SDK_INT).all {
            owner.checkSelfPermission(it) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
    }
    override fun requestBluetoothPermissions() {
        requireNotNull(activity) { "Activity permission owner is unavailable" }.requestPermissions(
            requiredBluetoothPermissions(android.os.Build.VERSION.SDK_INT), BluetoothPermissionRequest.CODE)
    }
}

data class BluetoothDiscoveryRequest(val timeoutMs: Int, val simulated: Boolean)
data class BluetoothConnectionRequest(val locationId: String, val autoReconnectOnUnexpectedDisconnect: Boolean)
fun interface NativeCancelable { fun cancel() }
/** Stripe 5.6 retrieve/connect provide no cancellation handle. This is deliberately not a fake cancel. */
object NonCancellableTerminalOperation : NativeCancelable { override fun cancel() = Unit }

/** Schedules the production collection deadline; tests provide deterministic implementations. */
fun interface CollectionDeadlineScheduler { fun schedule(delayMs: Long, task: () -> Unit): NativeCancelable }
/** All server recovery runs here; production injects a worker executor, tests can stay deterministic. */
fun interface NativeBackgroundExecutor { fun execute(task: () -> Unit) }
object DirectNativeBackgroundExecutor : NativeBackgroundExecutor { override fun execute(task: () -> Unit) = task() }
object NoopCollectionDeadlineScheduler : CollectionDeadlineScheduler { override fun schedule(delayMs: Long, task: () -> Unit) = NativeCancelable {} }
class AndroidCollectionDeadlineScheduler : CollectionDeadlineScheduler {
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    override fun schedule(delayMs: Long, task: () -> Unit): NativeCancelable {
        val runnable = Runnable(task)
        handler.postDelayed(runnable, delayMs)
        return NativeCancelable { handler.removeCallbacks(runnable) }
    }
}

/** Narrow SDK seam. Production maps these calls to Stripe Terminal 5.6.0. */
interface NativeTerminalAdapter {
    fun initialize(connectionTokenProvider: () -> String)
    fun discover(request: BluetoothDiscoveryRequest, onUpdate: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit): NativeCancelable
    fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable
    fun retrieve(clientSecret: String, onSuccess: (paymentIntentId: String) -> Unit, onFailure: () -> Unit): NativeCancelable
    fun collect(paymentIntentId: String, onSuccess: (paymentIntentId: String) -> Unit, onFailure: () -> Unit): NativeCancelable
    fun confirm(paymentIntentId: String, onSuccess: (paymentIntentId: String) -> Unit, onFailure: () -> Unit): NativeCancelable
    /** The production adapter reports the reader observed by its Terminal callbacks. */
    fun observedReaderId(): String? = null
    /** A stale successful noncancellable connection must still tear down the physical SDK link. */
    fun disconnect() = Unit
}

data class NativeCollectionAuthority(
    val session: StaffSession?,
    val ticket: AttemptTicket?,
    val observedReaderId: String?,
)

interface ConnectionTokenSource { fun connectionToken(session: StaffSession): String }
class StaffSessionConnectionTokenSource(private val transport: StaffSessionTransport) : ConnectionTokenSource {
    override fun connectionToken(session: StaffSession): String {
        val response = transport.postInternalPurchase(session, org.json.JSONObject().put("action", "connection-token"))
        require(response.status in 200..299) { "Connection token is unavailable" }
        return (org.json.JSONObject(response.body.decodeToString()).opt("secret") as? String)?.takeIf(String::isNotBlank)
            ?: throw IllegalArgumentException("Connection token is invalid")
    }
}

data class DurableAttempt(val ticket: AttemptTicket, val paymentIntentId: String)
sealed interface RecoveryState { data class FromServer(val payment: PaymentResult) : RecoveryState; data object ManualReconciliation : RecoveryState }
interface PaymentRecovery { fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState }
class PurchasePaymentRecovery(private val api: PurchaseApi) : PaymentRecovery {
    override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) = RecoveryState.FromServer(api.recover(session, ticket, paymentIntentId))
}

enum class NativeCollectionState {
    SESSION_READY, DISCOVERY_BLOCKED, DISCOVERING, READERS_AVAILABLE, READER_SELECTED, CONNECTING, CONNECTED,
    INTENT_DURABLY_CREATED, RETRIEVING_INTENT, COLLECTING, CONFIRMING, CANCELLING, RECOVERING, PAID,
    UNRESOLVED, MANUAL_RECONCILIATION, RECONNECT_REQUIRED,
}

/**
 * A single-reader, same-PaymentIntent state machine. Every async callback is accepted only for
 * its operation generation, expected state, and original PaymentIntent; all current mismatches
 * recover the durable server authority and stale callbacks are ignored.
 */
class NativeCollectionRuntime(
    private val configuration: NativeCollectionConfiguration,
    private val originalSession: StaffSession,
    private val originalTicket: AttemptTicket,
    private val terminal: NativeTerminalAdapter,
    private val permissions: BluetoothPermissions,
    private val connectionTokens: ConnectionTokenSource,
    private val recovery: PaymentRecovery,
    private val clock: () -> Long,
    private val provisionedReaderId: String? = originalTicket.readerId,
    private val deadlineScheduler: CollectionDeadlineScheduler = NoopCollectionDeadlineScheduler,
    private val backgroundExecutor: NativeBackgroundExecutor = DirectNativeBackgroundExecutor,
    private val authority: (() -> NativeCollectionAuthority)? = null,
) {
    companion object { const val DISCOVERY_TIMEOUT_MS = 10_000; const val COLLECTION_TIMEOUT_MS = 90_000L }
    private var initialized = false
    private var discoveryGeneration = 0L
    private var connectionGeneration = 0L
    private var paymentGeneration = 0L
    private var selectedReaderId: String? = null
    private var connectedReaderId: String? = null
    private var discoveryCancelable: NativeCancelable? = null
    private var connectionCancelable: NativeCancelable? = null
    private var activeCancelable: NativeCancelable? = null
    private var deadlineCancelable: NativeCancelable? = null
    private var deadlineAt: Long? = null
    private var activeAttempt: DurableAttempt? = null
    private var manualReconnectRequired = false
    private var discoveryListener: ((List<ConnectedReader>) -> Unit)? = null
    private var stateListener: (() -> Unit)? = null
    var state: NativeCollectionState = NativeCollectionState.SESSION_READY; private set
    var discoveredReaders: List<ConnectedReader> = emptyList(); private set
    val clientSecretRetained get() = false
    // Reconnecting after recovery is read-only: it never makes the retained attempt collectable.
    val readerDiscoveryReachable get() = configuration.collectionEnabled && initialized &&
        state in setOf(NativeCollectionState.SESSION_READY, NativeCollectionState.DISCOVERY_BLOCKED, NativeCollectionState.RECONNECT_REQUIRED, NativeCollectionState.READERS_AVAILABLE, NativeCollectionState.READER_SELECTED)
    val readerSelectionReachable get() = configuration.collectionEnabled && initialized && state == NativeCollectionState.READERS_AVAILABLE
    val readerConnectionReachable get() = configuration.collectionEnabled && initialized && state == NativeCollectionState.READER_SELECTED
    val hasActiveAttempt get() = activeAttempt != null
    val paymentActionsReachable get() = configuration.collectionEnabled && initialized && connectedReaderId != null && activeAttempt == null && state == NativeCollectionState.CONNECTED

    @Synchronized fun initialize() {
        check(configuration.collectionEnabled) { "Native collection is disabled" }; validateOriginalContext()
        if (!initialized) { terminal.initialize { connectionTokens.connectionToken(originalSession) }; initialized = true; notifyState() }
    }
    @Synchronized fun attachPermissionOwner(activity: android.app.Activity) { (permissions as? AndroidBluetoothPermissions)?.attach(activity) }
    @Synchronized fun setDiscoveryListener(listener: (List<ConnectedReader>) -> Unit) { discoveryListener = listener; listener(discoveredReaders) }
    @Synchronized fun setStateListener(listener: () -> Unit) { stateListener = listener; listener() }

    @Synchronized fun discover() {
        check(configuration.collectionEnabled && initialized) { "Native collection is disabled or uninitialized" }
        require(readerDiscoveryReachable) { "Discovery is not legal in $state" }
        if (!permissions.hasBluetoothPermissions()) { permissions.requestBluetoothPermissions(); transition(NativeCollectionState.DISCOVERY_BLOCKED); throw IllegalStateException("Bluetooth permission is required") }
        invalidateDiscovery()
        val generation = discoveryGeneration
        selectedReaderId = null; discoveredReaders = emptyList(); transition(NativeCollectionState.DISCOVERING)
        discoveryCancelable = terminal.discover(BluetoothDiscoveryRequest(DISCOVERY_TIMEOUT_MS, false), { readers -> synchronized(this) {
            if (generation != discoveryGeneration) return@synchronized
            if (state != NativeCollectionState.DISCOVERING && state != NativeCollectionState.READERS_AVAILABLE) { recoverIfActive(); return@synchronized }
            discoveredReaders = readers.toList()
            transition(if (discoveredReaders.isEmpty()) NativeCollectionState.DISCOVERING else NativeCollectionState.READERS_AVAILABLE)
            discoveryListener?.invoke(discoveredReaders)
        } }, { synchronized(this) {
            if (generation != discoveryGeneration) return@synchronized
            discoveredReaders = emptyList(); discoveryListener?.invoke(discoveredReaders); transition(NativeCollectionState.SESSION_READY)
        } })
    }

    @Synchronized fun onBluetoothPermissionResult(granted: Boolean) {
        if (!granted) {
            manualReconnectRequired = true
            invalidateDiscovery(); invalidateConnection(); discoveredReaders = emptyList(); discoveryListener?.invoke(discoveredReaders)
            if (activeAttempt != null) requestCancellation() else transition(NativeCollectionState.DISCOVERY_BLOCKED)
        } else if (state == NativeCollectionState.DISCOVERY_BLOCKED) transition(NativeCollectionState.SESSION_READY)
    }
    @Synchronized fun selectReader(reader: ConnectedReader) {
        require(readerSelectionReachable) { "Reader selection is not legal in $state" }
        val current = discoveredReaders.singleOrNull { it == reader } ?: throw IllegalArgumentException("Selected reader is not in the current discovery session")
        require(ReaderPolicy.matches(current, originalTicket, provisionedReaderId)) { "Selected reader is not physically compliant" }
        // Freeze the selected immutable snapshot; later discovery updates cannot replace it.
        invalidateDiscovery()
        selectedReaderId = current.id; transition(NativeCollectionState.READER_SELECTED)
    }
    @Synchronized fun connectSelectedReader() {
        require(readerConnectionReachable) { "Reader connection is not legal in $state" }
        if (!permissions.hasBluetoothPermissions()) { onBluetoothPermissionResult(false); permissions.requestBluetoothPermissions(); throw IllegalStateException("Bluetooth permission is required") }
        val reader = discoveredReaders.singleOrNull { it.id == requireNotNull(selectedReaderId) } ?: throw IllegalStateException("Selected reader is stale; discover and select again")
        require(ReaderPolicy.matches(reader, originalTicket, provisionedReaderId)) { "Selected reader is no longer compliant" }
        // Stop discovery before connection; adapter preserves only the explicitly selected SDK reader.
        invalidateDiscovery(); discoveredReaders = emptyList(); discoveryListener?.invoke(discoveredReaders)
        val generation = ++connectionGeneration
        transition(NativeCollectionState.CONNECTING)
        connectionCancelable = terminal.connect(reader, BluetoothConnectionRequest(Approved.LOCATION, false), { synchronized(this) {
            if (generation == connectionGeneration) onReaderDisconnected()
        } }, { synchronized(this) {
            if (generation != connectionGeneration) { terminal.disconnect(); return@synchronized }
            if (state != NativeCollectionState.CONNECTING) { invalidateConnection(); terminal.disconnect(); return@synchronized }
            connectedReaderId = reader.id; manualReconnectRequired = false; transition(NativeCollectionState.CONNECTED)
        } }, { synchronized(this) {
            if (generation != connectionGeneration) return@synchronized
            invalidateConnection(); transition(NativeCollectionState.RECONNECT_REQUIRED)
        } })
    }
    @Synchronized fun start(attempt: DurableAttempt, clientSecret: String) {
        require(paymentActionsReachable) { "Collection prerequisites are unavailable" }; validateOriginalContext()
        require(attempt.ticket == originalTicket && attempt.paymentIntentId.isNotBlank()) { "Durable attempt context changed" }; require(clientSecret.isNotBlank())
        activeAttempt = attempt; val generation = ++paymentGeneration
        transition(NativeCollectionState.INTENT_DURABLY_CREATED)
        deadlineCancelable?.cancel()
        deadlineAt = Math.addExact(clock(), COLLECTION_TIMEOUT_MS)
        deadlineCancelable = deadlineScheduler.schedule(COLLECTION_TIMEOUT_MS) { onDeadline(generation) }
        transition(NativeCollectionState.RETRIEVING_INTENT)
        val retrieve = terminal.retrieve(clientSecret, { id -> synchronized(this) { onRetrieved(generation, attempt, id) } }, { synchronized(this) { onOperationFailure(generation, NativeCollectionState.RETRIEVING_INTENT) } })
        if (paymentGeneration == generation && state == NativeCollectionState.RETRIEVING_INTENT) activeCancelable = retrieve
    }
    @Synchronized fun cancel() {
        require(activeAttempt != null && state in setOf(NativeCollectionState.RETRIEVING_INTENT, NativeCollectionState.COLLECTING, NativeCollectionState.CONFIRMING)) { "Cancellation is not legal in $state" }
        requestCancellation()
    }
    @Synchronized fun recover() { requireNotNull(activeAttempt) { "No active PaymentIntent to recover" }; invalidatePayment(); recoverOriginal() }
    @Synchronized fun onTimeAdvanced() {
        if (!hasCurrentAuthority()) invalidateContext()
        else if (activeAttempt != null && deadlineAt?.let { clock() >= it } == true) requestCancellation()
    }
    @Synchronized fun onDeadline(generation: Long) { if (generation == paymentGeneration && activeAttempt != null) requestCancellation() }
    @Synchronized fun onReaderDisconnected() { invalidateContext(requireManualReconnect = true) }
    @Synchronized fun onApplicationBackgrounded() = invalidateContext(requireManualReconnect = true)
    /** A fresh start merely revalidates current authority; valid context has no state transition. */
    @Synchronized fun onApplicationResumed() = revalidateContext()
    @Synchronized fun onSessionInvalidated() = invalidateContext()
    @Synchronized fun onReaderInvalidated() = invalidateContext(requireManualReconnect = true)
    @Synchronized fun onContextExpired() = revalidateContext()
    @Synchronized fun revalidateContext() { if (!hasCurrentAuthority()) invalidateContext(requireManualReconnect = connectedReaderId != null) }

    private fun onRetrieved(generation: Long, attempt: DurableAttempt, id: String) {
        if (!current(generation, NativeCollectionState.RETRIEVING_INTENT, attempt, id)) return
        transition(NativeCollectionState.COLLECTING)
        val collect = terminal.collect(id, { collected -> synchronized(this) { onCollected(generation, attempt, collected) } }, { synchronized(this) { onOperationFailure(generation, NativeCollectionState.COLLECTING) } })
        if (paymentGeneration == generation && state == NativeCollectionState.COLLECTING) activeCancelable = collect
    }
    private fun onCollected(generation: Long, attempt: DurableAttempt, id: String) {
        if (!current(generation, NativeCollectionState.COLLECTING, attempt, id)) return
        transition(NativeCollectionState.CONFIRMING)
        val confirm = terminal.confirm(id, { confirmed -> synchronized(this) { onConfirmed(generation, attempt, confirmed) } }, { synchronized(this) { onOperationFailure(generation, NativeCollectionState.CONFIRMING) } })
        if (paymentGeneration == generation && state == NativeCollectionState.CONFIRMING) activeCancelable = confirm
    }
    private fun onConfirmed(generation: Long, attempt: DurableAttempt, id: String) {
        if (!current(generation, NativeCollectionState.CONFIRMING, attempt, id)) return
        invalidatePayment(); recoverOriginal()
    }
    private fun onOperationFailure(generation: Long, expected: NativeCollectionState) {
        if (generation != paymentGeneration) return
        if (state == NativeCollectionState.CANCELLING) { completeCancellation(); return }
        if (state != expected) { recoverIfActive(); return }
        invalidatePayment(); recoverOriginal()
    }
    private fun current(generation: Long, expected: NativeCollectionState, attempt: DurableAttempt, id: String): Boolean {
        if (generation != paymentGeneration) return false
        if (state == NativeCollectionState.CANCELLING) { completeCancellation(); return false }
        if (state != expected || activeAttempt != attempt || id != attempt.paymentIntentId) { invalidatePayment(); recoverOriginal(); return false }
        return true
    }
    private fun requestCancellation() {
        val operation = activeCancelable
        // Recovery and resolved states have no Terminal callback capable of completing cancellation.
        // Supersede any pending recovery and reconcile the same durable intent again instead.
        if (operation == null) { invalidatePayment(); recoverOriginal(); return }
        // Stripe retrievePaymentIntent has no Cancelable. It is the sole payment step allowed to
        // invalidate its generation and reconcile immediately.
        if (state == NativeCollectionState.RETRIEVING_INTENT && operation === NonCancellableTerminalOperation) {
            invalidatePayment(); recoverOriginal(); return
        }
        deadlineCancelable?.cancel(); deadlineCancelable = null; deadlineAt = null
        transition(NativeCollectionState.CANCELLING)
        operation?.cancel()
    }
    private fun completeCancellation() {
        paymentGeneration++; deadlineCancelable?.cancel(); deadlineCancelable = null; deadlineAt = null
        activeCancelable = null
        recoverOriginal()
    }
    private fun invalidatePayment() {
        paymentGeneration++; deadlineCancelable?.cancel(); deadlineCancelable = null; deadlineAt = null
        activeCancelable?.takeUnless { it === NonCancellableTerminalOperation }?.cancel(); activeCancelable = null
    }
    private fun invalidateDiscovery() { discoveryGeneration++; discoveryCancelable?.cancel(); discoveryCancelable = null }
    private fun invalidateConnection() {
        val hadConnectedReader = connectedReaderId != null
        connectionGeneration++; connectionCancelable?.takeUnless { it === NonCancellableTerminalOperation }?.cancel()
        connectionCancelable = null; connectedReaderId = null; selectedReaderId = null
        if (hadConnectedReader) terminal.disconnect()
    }
    private fun invalidateContext(requireManualReconnect: Boolean = false) {
        manualReconnectRequired = manualReconnectRequired || requireManualReconnect
        invalidateDiscovery(); invalidateConnection(); discoveredReaders = emptyList(); discoveryListener?.invoke(discoveredReaders)
        if (activeAttempt != null) requestCancellation() else transition(NativeCollectionState.RECONNECT_REQUIRED)
    }
    private fun recoverIfActive() { if (activeAttempt != null) { invalidatePayment(); recoverOriginal() } }
    private fun recoverOriginal() {
        val attempt = requireNotNull(activeAttempt) { "No active PaymentIntent to recover" }
        val generation = ++paymentGeneration
        transition(NativeCollectionState.RECOVERING)
        backgroundExecutor.execute {
            val recovered = try { recovery.recover(originalSession, originalTicket, attempt.paymentIntentId) } catch (_: Exception) { RecoveryState.ManualReconciliation }
            synchronized(this) {
                // A later invalidation/recovery owns state; this worker cannot revive stale context.
                if (generation != paymentGeneration || state != NativeCollectionState.RECOVERING || activeAttempt != attempt) return@synchronized
                when (recovered) {
                    RecoveryState.ManualReconciliation -> transition(NativeCollectionState.MANUAL_RECONCILIATION)
                    is RecoveryState.FromServer -> {
                        val payment = recovered.payment
                        if (payment.id != attempt.paymentIntentId || (payment.status == "succeeded") != payment.paid) {
                            transition(NativeCollectionState.MANUAL_RECONCILIATION)
                        } else if (payment.paid) transition(NativeCollectionState.PAID)
                        else if (manualReconnectRequired) transition(NativeCollectionState.RECONNECT_REQUIRED)
                        else transition(NativeCollectionState.UNRESOLVED)
                    }
                }
            }
        }
    }
    private fun transition(next: NativeCollectionState) { state = next; notifyState() }
    private fun notifyState() { stateListener?.invoke() }
    private fun requireReadyForReaderWork() { check(configuration.collectionEnabled && initialized) { "Native collection is disabled or uninitialized" }; validateOriginalContext() }
    private fun hasCurrentAuthority(): Boolean {
        val current = authority?.invoke()
            ?: NativeCollectionAuthority(originalSession, originalTicket, connectedReaderId)
        return current.session == originalSession && current.ticket == originalTicket &&
            originalSession.origin == configuration.approvedOrigin && originalSession.association.isNotBlank() &&
            originalSession.expiresAt > clock() && originalTicket.expiresAt > clock() &&
            originalTicket.locationId == Approved.LOCATION &&
            (connectedReaderId == null || current.observedReaderId == connectedReaderId)
    }
    private fun validateOriginalContext() { require(hasCurrentAuthority()) { "Original session, ticket, reader, or expiry changed" } }
}
