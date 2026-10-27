package com.pli.kiosk.android

import android.app.Application
import android.os.Handler
import android.util.Log
import com.stripe.stripeterminal.TerminalApplicationDelegate
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.Executors

/** Server calls are serialized off the UI thread; tests inject the direct executor explicitly. */
fun interface OperatorBackgroundExecutor { fun execute(task: () -> Unit) }
object DirectOperatorBackgroundExecutor : OperatorBackgroundExecutor { override fun execute(task: () -> Unit) = task() }
class AndroidOperatorBackgroundExecutor : OperatorBackgroundExecutor {
    private val delegate = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "kiosk-network").apply { isDaemon = true } }
    override fun execute(task: () -> Unit) = delegate.execute(task)
}
fun interface OperatorUiDispatcher { fun execute(task: () -> Unit) }

internal fun initializeKioskApplicationLifecycle(terminal: () -> Unit, runtime: () -> Unit) {
    terminal()
    runtime()
}

/** Transient server-authorized material is passed directly to Terminal and is never retained. */
data class TransientCollectionStart(val attempt: DurableAttempt, val clientSecret: String)
data class SelfServiceRollover(
    val selection: StudentSelectionActions,
    val startSource: () -> TransientCollectionStart,
)

internal fun clearResolvedAttempt(store: StateStore, state: DurableState): DurableState {
    if (state.attempt?.resolved != true) return state
    return DurableState(state.session).also(store::write)
}

internal fun retryRuntimeInitialization(
    attempts: Int = 3,
    delayMillis: Long = 250,
    schedule: (Long, () -> Unit) -> Unit,
    initialize: () -> OperatorRuntime,
    publish: (OperatorRuntime) -> Unit,
) {
    require(attempts > 0)
    fun attempt(remaining: Int, delay: Long) {
        val runtime = runCatching(initialize).getOrNull()
        if (runtime != null) publish(runtime)
        else if (remaining > 1) runCatching { schedule(delay) { attempt(remaining - 1, delay * 2) } }
    }
    attempt(attempts, delayMillis)
}

/**
 * Production UI binding. Its collection source is a coordinator call, so the original ID is
 * durable before Terminal receives its transient client secret. Login is available only where the
 * composition has the strict transport and a coordinator with no retained attempt.
 */
class ProductionOperatorRuntime(
    native: NativeCollectionRuntime?,
    selection: StudentSelectionActions,
    startSource: (() -> TransientCollectionStart)?,
    private val loginSource: ((String, CharArray) -> Unit)? = null,
    private val nativeFactory: ((AttemptTicket) -> NativeCollectionRuntime)? = null,
    private val backgroundExecutor: OperatorBackgroundExecutor = DirectOperatorBackgroundExecutor,
    private val paidRollover: (() -> SelfServiceRollover)? = null,
    private val uiDispatcher: OperatorUiDispatcher? = null,
) : OperatorRuntime {
    private var native: NativeCollectionRuntime? = native
    private var selection: StudentSelectionActions = selection
    private var startSource: (() -> TransientCollectionStart)? = startSource
    private var readerListener: ((List<ConnectedReader>) -> Unit)? = null
    private var stateListener: (() -> Unit)? = null
    private var activity: android.app.Activity? = null
    @Volatile private var networkOperationInFlight = false

    init { native?.let(::bindNative) }

    override val attemptStartEnabled: Boolean
        get() = !networkOperationInFlight && native == null && (selection as? PurchaseCoordinator)?.canBeginAttempt == true
    override val readerDiscoveryEnabled: Boolean
        get() = native?.readerDiscoveryReachable == true
    override val readerSelectionEnabled: Boolean
        get() = native?.readerSelectionReachable == true
    override val readerConnectionEnabled: Boolean
        get() = native?.readerConnectionReachable == true
    override val collectionControlsEnabled: Boolean
        get() = !networkOperationInFlight && underlyingCollectionControlsEnabled()
    override val recoveryEnabled: Boolean
        get() = !networkOperationInFlight && (native?.hasActiveAttempt == true || (selection as? PurchaseCoordinator)?.hasKnownPaymentIntent() == true)
    override val studentLookupEnabled: Boolean
        get() = !networkOperationInFlight && underlyingStudentLookupEnabled()
    override val discoveredReaders: List<ConnectedReader>
        get() = native?.discoveredReaders.orEmpty()

    override fun login(slug: String, pin: CharArray) { requireNotNull(loginSource) { "Staff login is unavailable" }.invoke(slug, pin) }
    override fun loginAsync(slug: String, pin: CharArray, complete: (Boolean) -> Unit) = network(complete) { login(slug, pin) }
    override fun lookupStudentAsync(phone: String, complete: (StudentLookupResult) -> Unit) = networkResult(complete) { lookupStudent(phone) }

    override fun beginAttempt() {
        val coordinator = selection as? PurchaseCoordinator
            ?: throw IllegalStateException("Signed ticket issuance is unavailable")
        require(native == null) { "A retained ticket must be resumed, not replaced" }
        coordinator.start()
        val created = requireNotNull(nativeFactory) { "Native collection composition is unavailable" }
            .invoke(coordinator.retainedTicketForNativeRuntime())
        created.initialize()
        bindNative(created)
    }
    override fun beginAttemptAsync(complete: (Boolean) -> Unit) = network(complete, ::beginAttempt)

    override fun lookupStudent(phone: String): StudentLookupResult {
        require(underlyingStudentLookupEnabled()) { "Staff login is required before student lookup" }
        return selection.lookupStudent(phone)
    }
    override fun confirmSelectedStudent(): MinimumStudentIdentity = selection.confirmSelectedStudent()
    override fun discoverReaders() = requireNative().discover()
    override fun selectReader(reader: ConnectedReader) = requireNative().selectReader(reader)
    override fun connectSelectedReader() = requireNative().connectSelectedReader()
    override fun startCollection() {
        require(underlyingCollectionControlsEnabled()) { "Collection prerequisites are unavailable" }
        val start = requireNotNull(startSource) { "Fresh collection context is unavailable" }.invoke()
        requireNative().start(start.attempt, start.clientSecret)
    }
    override fun startCollectionAsync(complete: (Boolean) -> Unit) = network(complete, ::startCollection)
    override fun cancelCollection() = requireNative().cancel()
    override fun recoverPaymentStatus() {
        val active = native
        if (active?.hasActiveAttempt == true) active.recover()
        else (selection as? PurchaseCoordinator)?.recoverKnownAttempt()
            ?: throw IllegalStateException("No known PaymentIntent exists to recover")
    }
    override fun recoverPaymentStatusAsync(complete: (Boolean) -> Unit) = network(complete, ::recoverPaymentStatus)
    override fun onBluetoothPermissionResult(granted: Boolean) = native?.onBluetoothPermissionResult(granted) ?: Unit
    override fun attachPermissionOwner(activity: android.app.Activity) { this.activity = activity; native?.attachPermissionOwner(activity) }
    override fun onApplicationBackgrounded() = native?.onApplicationBackgrounded() ?: Unit
    override fun onApplicationResumed() = native?.onApplicationResumed() ?: Unit
    override fun onSessionInvalidated() = native?.onSessionInvalidated() ?: Unit
    override fun onReaderInvalidated() = native?.onReaderInvalidated() ?: Unit
    override fun onContextExpired() = native?.onContextExpired() ?: Unit
    override fun revalidateContext() = native?.revalidateContext() ?: Unit
    override fun setReaderUpdateListener(listener: (List<ConnectedReader>) -> Unit) {
        readerListener = listener
        val current = native
        current?.setDiscoveryListener { readers -> postToUi { if (current === native) listener(readers) } }
            ?: listener(emptyList())
    }
    override fun setStateListener(listener: () -> Unit) { stateListener = listener; listener() }

    private fun underlyingStudentLookupEnabled(): Boolean =
        (selection as? PurchaseCoordinator)?.let { runCatching(it::studentLookupEnabled).getOrDefault(false) }
            ?: (loginSource == null)

    private fun underlyingCollectionControlsEnabled(): Boolean =
        native?.paymentActionsReachable == true && startSource != null

    private fun network(complete: (Boolean) -> Unit, action: () -> Unit) {
        check(!networkOperationInFlight) { "A network action is already in progress" }
        networkOperationInFlight = true; stateListener?.invoke()
        backgroundExecutor.execute {
            val accepted = runCatching(action).isSuccess
            postToUi {
                networkOperationInFlight = false
                stateListener?.invoke()
                complete(accepted)
            }
        }
    }
    private fun networkResult(complete: (StudentLookupResult) -> Unit, action: () -> StudentLookupResult) {
        check(!networkOperationInFlight) { "A network action is already in progress" }
        networkOperationInFlight = true; stateListener?.invoke()
        backgroundExecutor.execute {
            val result = runCatching(action).getOrDefault(StudentLookupResult.Invalid)
            postToUi {
                networkOperationInFlight = false
                stateListener?.invoke()
                complete(result)
            }
        }
    }

    private fun bindNative(created: NativeCollectionRuntime) {
        native = created
        activity?.let(created::attachPermissionOwner)
        created.setStateListener { onNativeState(created) }
        readerListener?.let { listener ->
            created.setDiscoveryListener { readers -> postToUi { if (created === native) listener(readers) } }
        }
    }
    private fun onNativeState(source: NativeCollectionRuntime) {
        if (source !== native) return
        if (source.state == NativeCollectionState.PAID) {
            val replacement = runCatching { paidRollover?.invoke() }.getOrNull()
            if (replacement != null) {
                selection = replacement.selection
                startSource = replacement.startSource
                native = null
                postToUi {
                    readerListener?.invoke(emptyList())
                    stateListener?.invoke()
                }
                return
            }
        }
        postToUi { if (source === native) stateListener?.invoke() }
    }
    private fun postToUi(task: () -> Unit) {
        uiDispatcher?.execute(task) ?: activity?.runOnUiThread(task) ?: task()
    }

    private fun requireNative(): NativeCollectionRuntime = requireNotNull(native) { "Signed ticket binding is required" }
}

/** One admitted bridge owns its opaque-operation registry and its context-local permission edge. */
internal class PreparedBridgeContext(
    val bridge: SecureWebBridge,
    internal val operations: PreparedBridgeOperations,
    private val permissionOwner: (android.app.Activity) -> Unit = {},
    private val warmReader: ReaderConnectionLifecycle? = null,
    val events: NativeWebEvents? = null,
) {
    internal val lifecycleOwner: PreparedBridgeLifecycle = object : PreparedBridgeLifecycle {
        override fun onBluetoothPermissionResult(granted: Boolean) {
            operations.onBluetoothPermissionResult(granted)
            warmReader?.onBluetoothPermissionResult(granted)
        }
        override fun onApplicationBackgrounded() {
            operations.onApplicationBackgrounded()
            stopReader()
        }
        override fun onSessionInvalidated() {
            operations.onSessionInvalidated()
            stopReader()
        }
        override fun onReaderInvalidated() {
            operations.onReaderInvalidated()
            stopReader()
        }
    }

    private fun stopReader() {
        events?.invalidate()
        warmReader?.invalidate()
    }

    internal fun attachPermissionOwner(activity: android.app.Activity) {
        permissionOwner(activity)
        warmReader?.start()
    }
}

/** Generates a request-independent, 32-byte URL-safe opaque operation reference. */
internal fun newPreparedBridgeOperationReference(): String = ByteArray(32).also(SecureRandom()::nextBytes)
    .let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }

/**
 * Process-level composition point. It initializes Stripe Terminal only for an explicitly enabled,
 * approved-origin build with the original durable session/attempt context. A configured build with
 * no attempt still receives the strict login/lookup runtime; it cannot collect without a native
 * attempt context.
 */
class KioskApplication : Application() {
    var operatorRuntime: OperatorRuntime = DisabledOperatorRuntime
        private set

    override fun onCreate() {
        super.onCreate()
        initializeKioskApplicationLifecycle(
            terminal = { TerminalApplicationDelegate.onCreate(this) },
            runtime = ::initializeRuntime,
        )
    }

    private fun initializeRuntime() {
        val configuration = runCatching(NativeCollectionConfiguration::fromBuildConfig).getOrElse { return }
        if (!configuration.collectionEnabled) return
        val handler = Handler(mainLooper)
        retryRuntimeInitialization(
            schedule = { delay, task -> handler.postDelayed(task, delay) },
            initialize = { createProductionRuntime(configuration) },
            publish = { operatorRuntime = it },
        )
    }

    private fun createProductionRuntime(configuration: NativeCollectionConfiguration): OperatorRuntime {
        val origin = ApprovedOrigin(configuration.approvedOrigin)
        val networkExecutor = AndroidOperatorBackgroundExecutor()
        val store = EncryptedStateStore(this)
        val transport = StaffSessionTransport(origin, System::currentTimeMillis)
        var purchase = PurchaseCoordinator(origin, store, StaffSessionPurchaseApi(transport), System::currentTimeMillis)
        val loginSource = { slug: String, pin: CharArray -> purchase.login { transport.login(slug, pin) }; Unit }
        val state = store.read()
        val nativeForTicket: (AttemptTicket) -> NativeCollectionRuntime = { boundTicket ->
            val latest = store.read()
            val boundSession = requireNotNull(latest.session) { "Original staff session is unavailable" }
            val boundAttempt = requireNotNull(latest.attempt) { "Signed ticket binding is unavailable" }
            require(boundAttempt.ticket == boundTicket && !boundAttempt.resolved) { "Signed ticket binding changed" }
            val terminal = StripeTerminalSdkAdapter(this, boundTicket.readerId, boundTicket.locationId)
            NativeCollectionRuntime(
                configuration,
                boundSession,
                boundTicket,
                terminal,
                AndroidBluetoothPermissions(),
                StaffSessionConnectionTokenSource(transport),
                PurchasePaymentRecovery(StaffSessionPurchaseApi(transport)),
                System::currentTimeMillis,
                deadlineScheduler = AndroidCollectionDeadlineScheduler(),
                backgroundExecutor = NativeBackgroundExecutor { task -> networkExecutor.execute(task) },
                authority = {
                    val current = store.read()
                    NativeCollectionAuthority(current.session, current.attempt?.ticket, terminal.observedReaderId())
                },
            )
        }
        val session = state.session
        val attempt = state.attempt
        val ticket = attempt?.ticket
        val startSource = { purchase.startCollection() }
        val paidRollover = {
            require(purchase.recoverKnownAttempt() == Outcome.PAID) { "Paid rollover requires fresh server authority" }
            val paidState = store.read()
            require(paidState.attempt?.resolved == true) { "Paid rollover requires a resolved durable attempt" }
            store.write(DurableState(paidState.session))
            purchase = PurchaseCoordinator(origin, store, StaffSessionPurchaseApi(transport), System::currentTimeMillis)
            SelfServiceRollover(purchase) { purchase.startCollection() }
        }
        if (session == null || attempt == null || ticket == null || attempt.resolved ||
            attempt.sessionAssociation != session.association || attempt.origin != session.origin
        ) {
            return ProductionOperatorRuntime(
                null, purchase, startSource, loginSource, nativeForTicket, networkExecutor, paidRollover,
            )
        }

        val native = nativeForTicket(ticket)
        native.initialize()
        return ProductionOperatorRuntime(
            native, purchase, startSource, loginSource, nativeForTicket, networkExecutor, paidRollover,
        )
    }

    /**
     * BuildConfig-gated factory for the later Web host. Construction allocates no native runtime;
     * every admitted operation creates and owns its one runtime/bootstrap pair.
     */
    internal fun createPreparedBridgeContext(
        admission: SecureWebAdmission,
        renewSession: () -> Boolean = { false },
    ): PreparedBridgeContext? {
        val configuration = runCatching(NativeCollectionConfiguration::fromBuildConfig).getOrNull() ?: return null
        if (!configuration.collectionEnabled || configuration.approvedOrigin != admission.origin) return null
        return runCatching {
            val origin = ApprovedOrigin(configuration.approvedOrigin)
            val clock = System::currentTimeMillis
            val store = EncryptedStateStore(this)
            val transport = StaffSessionTransport(origin, clock)
            val purchaseApi = StaffSessionPurchaseApi(transport)
            val coordinator = PurchaseCoordinator(origin, store, purchaseApi, clock, purchaseApi)
            val executor = AndroidOperatorBackgroundExecutor()
            val permissions = AndroidBluetoothPermissions()
            val connectionTokens = StaffSessionConnectionTokenSource(transport)
            val initialState = store.read()
            val warmSession = requireNotNull(initialState.session) { "Warm reader requires the captured staff session" }
            require(initialState.attempt == null && warmSession.expiresAt > clock() && warmSession.origin == origin.value) {
                "Warm reader requires an empty current session context"
            }
            val terminal = StripeTerminalSdkAdapter(this, PROVISIONED_READER_ID, Approved.LOCATION)
            val events = NativeWebEvents()
            val warmReader = ReaderConnectionOwner(
                terminal, permissions,
                connectionTokenProvider = {
                    val latest = store.read()
                    val current = requireNotNull(latest.session) { "Warm reader session is unavailable" }
                    require(latest.attempt == null && current.expiresAt > clock() &&
                        current.origin == warmSession.origin && current.association == warmSession.association &&
                        current.cookie == warmSession.cookie
                    ) { "Warm reader session authority changed" }
                    connectionTokens.connectionToken(current)
                },
                provisionedReaderId = PROVISIONED_READER_ID,
                locationId = Approved.LOCATION,
                scheduler = AndroidCollectionDeadlineScheduler(),
                onStatus = events::readerStatus,
                onReaderInputRequested = { events.collectionPrompt(CollectionPrompt.AWAITING_CARD) },
            )
            val runtimeFactory = NativeCollectionRuntimeFactory { preparedAttempt ->
                val latest = store.read()
                val session = requireNotNull(latest.session) { "Original staff session is unavailable" }
                val retained = requireNotNull(latest.attempt) { "Prepared attempt is unavailable" }
                require(session.expiresAt > clock() && session.origin == origin.value) { "Original staff session changed" }
                require(preparedAttempt.mode == AttemptMode.PREPARED && !preparedAttempt.resolved &&
                    retained.mode == AttemptMode.PREPARED && !retained.resolved &&
                    retained.ticket == preparedAttempt.ticket &&
                    retained.sessionAssociation == preparedAttempt.sessionAssociation &&
                    retained.origin == preparedAttempt.origin &&
                    retained.sessionAssociation == session.association && retained.origin == session.origin
                ) { "Prepared attempt binding changed" }
                val ticket = requireNotNull(preparedAttempt.ticket) { "Prepared attempt has no ticket" }
                require(ticket.readerId == PROVISIONED_READER_ID) { "Prepared ticket reader is not provisioned" }
                NativeCollectionRuntime(
                    configuration, session, ticket, terminal, permissions,
                    connectionTokens, PreparedPurchasePaymentRecovery(purchaseApi), clock,
                    provisionedReaderId = PROVISIONED_READER_ID,
                    deadlineScheduler = AndroidCollectionDeadlineScheduler(),
                    backgroundExecutor = NativeBackgroundExecutor { task -> executor.execute(task) },
                    authority = {
                        val current = store.read()
                        val currentSession = current.session
                        val currentAttempt = current.attempt
                        val valid = currentSession == session && currentSession.expiresAt > clock() &&
                            currentAttempt?.mode == AttemptMode.PREPARED && currentAttempt?.resolved == false &&
                            currentAttempt.ticket == ticket && currentAttempt.sessionAssociation == session.association &&
                            currentAttempt.origin == session.origin
                        NativeCollectionAuthority(
                            if (valid) currentSession else null,
                            if (valid) currentAttempt?.ticket else null,
                            terminal.observedReaderId(),
                        )
                    },
                )
            }
            preparePreparedBridgeContext(
                configuration, admission,
                workflowFactory = {
                    ProductionPreparedBridgeWorkflow(
                        coordinator, executor, runtimeFactory,
                        PinnedReaderBootstrapRuntimeFactory { _, runtime -> NativeCollectionBootstrapRuntime(runtime, permissions) },
                        PROVISIONED_READER_ID, clock,
                        bootstrapDeadlineScheduler = AndroidCollectionDeadlineScheduler(),
                        beforeSaleDiscovery = warmReader::retireDiscovery,
                        onCollectionPrompt = events::collectionPrompt,
                        renewSession = renewSession,
                    )
                },
                permissionOwner = permissions::attach,
                warmReader = warmReader,
                events = events,
                livenessScheduler = AndroidCollectionDeadlineScheduler(),
            )
        }.getOrNull()
    }

    /** Test seam for the BuildConfig gate and real factory's bridge-only composition. */
    internal fun preparePreparedBridgeContext(
        configuration: NativeCollectionConfiguration,
        admission: SecureWebAdmission,
        workflowFactory: () -> PreparedBridgeWorkflow,
        operationReferenceGenerator: () -> String = ::newPreparedBridgeOperationReference,
        permissionOwner: (android.app.Activity) -> Unit = {},
        warmReader: ReaderConnectionLifecycle? = null,
        events: NativeWebEvents? = null,
        livenessScheduler: CollectionDeadlineScheduler = NoopCollectionDeadlineScheduler,
    ): PreparedBridgeContext? {
        if (!configuration.collectionEnabled || configuration.approvedOrigin != admission.origin) return null
        return runCatching {
            val operations = PreparedBridgeOperations(workflowFactory(), livenessScheduler = livenessScheduler)
            val registry = operations.bridgeOperations() + listOfNotNull(events?.let { channel ->
                NativeWebEvents.READ_STATUS to SecureBridgeOperation(emptyMap()) { channel.requestStatus(); SecureBridgeState.ACCEPTED }
            })
            PreparedBridgeContext(
                SecureWebBridge(registry) { _, _ -> operationReferenceGenerator() },
                operations,
                permissionOwner,
                warmReader,
                events,
            )
        }.getOrNull()
    }

    /** Session capture remains available for the web PaymentElement even when collection is disabled. */
    internal fun createWebSessionReadiness(
        admission: SecureWebAdmission,
        onRecoveryReady: () -> Boolean = { true },
    ): WebSessionReadiness {
        val origin = ApprovedOrigin(admission.origin)
        val clock = System::currentTimeMillis
        return WebSessionReadiness(
            origin = origin,
            store = EncryptedStateStore(this),
            transport = StaffSessionTransport(origin, clock),
            cookieReader = CookieManagerBrowserCookieReader,
            clock = clock,
            backgroundExecutor = AndroidOperatorBackgroundExecutor(),
            onRecoveryReady = onRecoveryReady,
            onRecoveryStage = { stage -> Log.i("PliKioskRecovery", stage.name) },
        )
    }

    /** Test seam for the real composition; fakes replace only terminal/permission transport edges. */
    internal fun composeRuntime(
        configuration: NativeCollectionConfiguration,
        session: StaffSession,
        ticket: AttemptTicket,
        terminal: NativeTerminalAdapter,
        permissions: BluetoothPermissions,
        tokens: ConnectionTokenSource,
        recovery: PaymentRecovery,
        selection: StudentSelectionActions,
        clock: () -> Long,
        loginSource: ((String, CharArray) -> Unit)? = null,
    ): OperatorRuntime {
        if (!configuration.collectionEnabled) return DisabledOperatorRuntime
        val native = NativeCollectionRuntime(configuration, session, ticket, terminal, permissions, tokens, recovery, clock)
        native.initialize()
        val source = (selection as? PurchaseCoordinator)?.let { coordinator -> { coordinator.startCollection() } }
        return ProductionOperatorRuntime(native, selection, source, loginSource)
    }

    private companion object {
        const val PROVISIONED_READER_ID = "tmr_GrudQifObHAVgT"
    }
}
