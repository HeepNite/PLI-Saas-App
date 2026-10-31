package com.pli.kiosk.android

import android.app.Application
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

/** Transient server-authorized material is passed directly to Terminal and is never retained. */
data class TransientCollectionStart(val attempt: DurableAttempt, val clientSecret: String)

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
 * Process-level composition point. Startup only registers the Stripe Terminal lifecycle delegate;
 * it never reads durable state or builds a collection runtime. Native collection exists solely per
 * admitted web-hosted prepared operation, so a retained non-prepared attempt can never resume.
 */
class KioskApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        TerminalApplicationDelegate.onCreate(this)
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

    private companion object {
        const val PROVISIONED_READER_ID = "tmr_GrudQifObHAVgT"
    }
}
