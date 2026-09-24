package com.pli.kiosk.android

import android.app.Application
import java.util.concurrent.Executors

/** Server calls are serialized off the UI thread; tests inject the direct executor explicitly. */
fun interface OperatorBackgroundExecutor { fun execute(task: () -> Unit) }
object DirectOperatorBackgroundExecutor : OperatorBackgroundExecutor { override fun execute(task: () -> Unit) = task() }
class AndroidOperatorBackgroundExecutor : OperatorBackgroundExecutor {
    private val delegate = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "kiosk-network").apply { isDaemon = true } }
    override fun execute(task: () -> Unit) = delegate.execute(task)
}

/** Transient server-authorized material is passed directly to Terminal and is never retained. */
data class TransientCollectionStart(val attempt: DurableAttempt, val clientSecret: String)

/**
 * Production UI binding. Its collection source is a coordinator call, so the original ID is
 * durable before Terminal receives its transient client secret. Login is available only where the
 * composition has the strict transport and a coordinator with no retained attempt.
 */
class ProductionOperatorRuntime(
    native: NativeCollectionRuntime?,
    private val selection: StudentSelectionActions,
    private val startSource: (() -> TransientCollectionStart)?,
    private val loginSource: ((String, CharArray) -> Unit)? = null,
    private val nativeFactory: ((AttemptTicket) -> NativeCollectionRuntime)? = null,
    private val backgroundExecutor: OperatorBackgroundExecutor = DirectOperatorBackgroundExecutor,
) : OperatorRuntime {
    private var native: NativeCollectionRuntime? = native
    private var readerListener: ((List<ConnectedReader>) -> Unit)? = null
    private var stateListener: (() -> Unit)? = null
    private var activity: android.app.Activity? = null
    @Volatile private var networkOperationInFlight = false

    override val attemptStartEnabled: Boolean
        get() = !networkOperationInFlight && native == null && (selection as? PurchaseCoordinator)?.canBeginAttempt == true
    override val readerDiscoveryEnabled: Boolean
        get() = native?.readerDiscoveryReachable == true
    override val readerSelectionEnabled: Boolean
        get() = native?.readerSelectionReachable == true
    override val readerConnectionEnabled: Boolean
        get() = native?.readerConnectionReachable == true
    override val collectionControlsEnabled: Boolean
        get() = !networkOperationInFlight && native?.paymentActionsReachable == true && startSource != null
    override val recoveryEnabled: Boolean
        get() = !networkOperationInFlight && (native?.hasActiveAttempt == true || (selection as? PurchaseCoordinator)?.hasKnownPaymentIntent() == true)
    override val studentLookupEnabled: Boolean
        get() = !networkOperationInFlight && ((selection as? PurchaseCoordinator)?.let { runCatching(it::studentLookupEnabled).getOrDefault(false) }
            ?: (loginSource == null))
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
        native = created
        readerListener?.let(created::setDiscoveryListener)
        stateListener?.let(created::setStateListener)
    }
    override fun beginAttemptAsync(complete: (Boolean) -> Unit) = network(complete, ::beginAttempt)

    override fun lookupStudent(phone: String): StudentLookupResult {
        require(studentLookupEnabled) { "Staff login is required before student lookup" }
        return selection.lookupStudent(phone)
    }
    override fun confirmSelectedStudent(): MinimumStudentIdentity = selection.confirmSelectedStudent()
    override fun discoverReaders() = requireNative().discover()
    override fun selectReader(reader: ConnectedReader) = requireNative().selectReader(reader)
    override fun connectSelectedReader() = requireNative().connectSelectedReader()
    override fun startCollection() {
        require(collectionControlsEnabled) { "Collection prerequisites are unavailable" }
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
        native?.setDiscoveryListener(listener) ?: listener(emptyList())
    }
    override fun setStateListener(listener: () -> Unit) { stateListener = listener; native?.setStateListener(listener) ?: listener() }

    private fun network(complete: (Boolean) -> Unit, action: () -> Unit) {
        check(!networkOperationInFlight) { "A network action is already in progress" }
        networkOperationInFlight = true; stateListener?.invoke()
        backgroundExecutor.execute {
            val accepted = runCatching(action).isSuccess
            networkOperationInFlight = false
            stateListener?.invoke(); postToUi { complete(accepted) }
        }
    }
    private fun networkResult(complete: (StudentLookupResult) -> Unit, action: () -> StudentLookupResult) {
        check(!networkOperationInFlight) { "A network action is already in progress" }
        networkOperationInFlight = true; stateListener?.invoke()
        backgroundExecutor.execute {
            val result = runCatching(action).getOrDefault(StudentLookupResult.Invalid)
            networkOperationInFlight = false
            stateListener?.invoke(); postToUi { complete(result) }
        }
    }

    private fun postToUi(task: () -> Unit) { activity?.runOnUiThread(task) ?: task() }

    private fun requireNative(): NativeCollectionRuntime = requireNotNull(native) { "Signed ticket binding is required" }
}

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
        val configuration = NativeCollectionConfiguration.fromBuildConfig()
        if (!configuration.collectionEnabled) return

        val origin = ApprovedOrigin(configuration.approvedOrigin)
        val networkExecutor = AndroidOperatorBackgroundExecutor()
        val store = EncryptedStateStore(this)
        val transport = StaffSessionTransport(origin, System::currentTimeMillis)
        val purchase = PurchaseCoordinator(origin, store, StaffSessionPurchaseApi(transport), System::currentTimeMillis)
        val loginSource = { slug: String, pin: CharArray -> purchase.login { transport.login(slug, pin) }; Unit }
        val state = runCatching(store::read).getOrElse { return }
        val nativeForTicket: (AttemptTicket) -> NativeCollectionRuntime = { boundTicket ->
            val latest = store.read()
            val boundSession = requireNotNull(latest.session) { "Original staff session is unavailable" }
            val boundAttempt = requireNotNull(latest.attempt) { "Signed ticket binding is unavailable" }
            require(boundAttempt.ticket == boundTicket && !boundAttempt.resolved) { "Signed ticket binding changed" }
            val terminal = StripeTerminalSdkAdapter(this)
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
        if (session == null || attempt == null || ticket == null || attempt.resolved ||
            attempt.sessionAssociation != session.association || attempt.origin != session.origin
        ) {
            // The configured runtime can log in and bind a student, but no reader work is exposed
            // until beginAttempt has durably retained the opaque signed ticket.
            operatorRuntime = ProductionOperatorRuntime(null, purchase, startSource, loginSource, nativeForTicket, networkExecutor)
            return
        }

        val native = nativeForTicket(ticket)
        native.initialize()
        operatorRuntime = ProductionOperatorRuntime(native, purchase, startSource, loginSource, nativeForTicket, networkExecutor)
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
}
