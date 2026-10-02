package com.pli.kiosk.android

import android.content.Context
import com.stripe.stripeterminal.Terminal
import com.stripe.stripeterminal.external.callable.Callback
import com.stripe.stripeterminal.external.callable.Cancelable
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider
import com.stripe.stripeterminal.external.callable.DiscoveryListener
import com.stripe.stripeterminal.external.callable.MobileReaderListener
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback
import com.stripe.stripeterminal.external.callable.ReaderCallback
import com.stripe.stripeterminal.external.callable.TerminalListener
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.BluetoothConnectionConfiguration
import com.stripe.stripeterminal.external.models.ConnectionTokenException
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration.BluetoothDiscoveryConfiguration
import com.stripe.stripeterminal.external.models.DisconnectReason
import com.stripe.stripeterminal.external.models.LocaleConfig
import com.stripe.stripeterminal.external.models.Reader
import com.stripe.stripeterminal.external.models.TerminalException
import com.stripe.stripeterminal.log.LogLevel
import java.util.concurrent.Executors

internal fun discoveredReaderKey(id: String?, serial: String, type: String, expectedReaderId: String? = null): String =
    id ?: expectedReaderId?.takeIf { serial == Approved.M2_SERIAL && type == "stripe_m2" }
    ?: "unregistered:$serial:$type"

internal fun acceptsConnectedReader(expectedId: String, connectedId: String?): Boolean =
    connectedId != null && (expectedId.startsWith("unregistered:") || connectedId == expectedId)

internal class RotatingConnectionTokenProvider {
    @Volatile private var source: (() -> String)? = null
    fun update(source: () -> String) { this.source = source }
    fun fetch(): String = requireNotNull(source) { "Connection token provider is unavailable" }.invoke()
}

/**
 * The sole production mapping to the locally verified Terminal 5.6.0 APIs. It makes no reader
 * selection, payment decision, or server-authority decision; NativeCollectionRuntime owns those.
 */
class StripeTerminalSdkAdapter(
    private val context: Context,
    private val expectedReaderId: String? = null,
) : NativeTerminalAdapter {
    /** Terminal may ask for a token on an arbitrary callback thread; never run HTTPS on the UI. */
    private val tokenExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "stripe-connection-token").apply { isDaemon = true }
    }
    /** SDK Reader objects exist only for the active discovery callback generation. */
    private val readers = mutableMapOf<String, Reader>()
    private var discoveryGeneration = 0L
    @Volatile private var observedConnectedReaderId: String? = null

    override fun observedReaderId(): String? = observedConnectedReaderId

    override fun disconnect() {
        observedConnectedReaderId = null
        Terminal.getInstance().disconnectReader(object : Callback {
            override fun onSuccess() = Unit
            override fun onFailure(e: TerminalException) = Unit
        })
    }

    override fun initialize(connectionTokenProvider: () -> String) {
        synchronized(processLock) {
            connectionTokens.update(connectionTokenProvider)
            if (initialized) return
            check(!Terminal.isInitialized()) { "Stripe Terminal was initialized outside this application composition" }
            Terminal.init(
                context.applicationContext,
                LogLevel.ERROR,
                object : ConnectionTokenProvider {
                    override fun fetchConnectionToken(callback: ConnectionTokenCallback) {
                        tokenExecutor.execute {
                            try {
                                callback.onSuccess(connectionTokens.fetch())
                            } catch (error: Exception) {
                                callback.onFailure(ConnectionTokenException("Original-session connection token unavailable", error))
                            }
                        }
                    }
                },
                object : TerminalListener {},
                null,
                LocaleConfig.CardLanguagePreferenceIfAvailable,
            )
            initialized = true
        }
    }

    override fun discover(
        request: BluetoothDiscoveryRequest,
        onUpdate: (List<ConnectedReader>) -> Unit,
        onFailure: () -> Unit,
    ): NativeCancelable {
        val terminal = Terminal.getInstance()
        val generation = synchronized(readers) {
            discoveryGeneration++
            readers.clear()
            discoveryGeneration
        }
        val cancelable = terminal.discoverReaders(
            BluetoothDiscoveryConfiguration(request.timeoutMs, request.simulated),
            object : DiscoveryListener {
                override fun onUpdateDiscoveredReaders(readers: List<Reader>) {
                    val snapshot = synchronized(this@StripeTerminalSdkAdapter.readers) {
                        if (generation != discoveryGeneration) return
                        this@StripeTerminalSdkAdapter.readers.clear()
                        readers.forEach { reader -> this@StripeTerminalSdkAdapter.readers[readerKey(reader)] = reader }
                        readers.map(::connectedReader)
                    }
                    onUpdate(snapshot)
                }
            },
            object : Callback {
                override fun onSuccess() = Unit
                override fun onFailure(e: TerminalException) {
                    System.err.println("PLI provisioning discovery failed: ${e.errorCode}: ${e.message}")
                    onFailure()
                }
            },
        )
        return NativeCancelable {
            synchronized(readers) {
                if (generation == discoveryGeneration) {
                    // Invalidate future discovery callbacks but retain the one explicitly selected
                    // SDK Reader long enough for connectSelectedReader to consume it.
                    discoveryGeneration++
                }
            }
            cancelable.cancel(object : Callback {
                override fun onSuccess() = Unit
                override fun onFailure(e: TerminalException) = Unit
            })
        }
    }

    override fun connect(
        reader: ConnectedReader,
        request: BluetoothConnectionRequest,
        onDisconnect: () -> Unit,
        onSuccess: () -> Unit,
        onFailure: () -> Unit,
    ): NativeCancelable {
        val expectedReaderId = reader.id
        val sdkReader = synchronized(readers) {
            requireNotNull(readers.remove(expectedReaderId)) { "Selected reader is no longer discovered" }
        }
        Terminal.getInstance().connectReader(
            sdkReader,
            BluetoothConnectionConfiguration(
                request.locationId,
                request.autoReconnectOnUnexpectedDisconnect,
                object : MobileReaderListener {
                    override fun onDisconnect(reason: DisconnectReason) {
                        observedConnectedReaderId = null
                        onDisconnect()
                    }
                },
            ),
            object : ReaderCallback {
                override fun onSuccess(reader: Reader) {
                    val connectedId = reader.id
                    if (acceptsConnectedReader(expectedReaderId, connectedId)) {
                        observedConnectedReaderId = connectedId
                        onSuccess()
                    } else onFailure()
                }
                override fun onFailure(e: TerminalException) {
                    System.err.println("PLI provisioning connection failed: ${e.errorCode}: ${e.message}")
                    observedConnectedReaderId = null
                    onFailure()
                }
            },
        )
        // Stripe 5.6 connectReader is callback-based and explicitly noncancellable. The runtime
        // invalidates its generation and ignores any late callback rather than pretending to cancel.
        return NonCancellableTerminalOperation
    }

    override fun retrieve(
        clientSecret: String,
        onSuccess: (String) -> Unit,
        onFailure: () -> Unit,
    ): NativeCancelable {
        Terminal.getInstance().retrievePaymentIntent(clientSecret, paymentCallback(onSuccess, onFailure))
        // Stripe 5.6 retrievePaymentIntent exposes no Cancelable.
        return NonCancellableTerminalOperation
    }

    override fun collect(
        paymentIntentId: String,
        onSuccess: (String) -> Unit,
        onFailure: () -> Unit,
    ): NativeCancelable = cancelable(
        Terminal.getInstance().collectPaymentMethod(
            paymentIntent(paymentIntentId),
            paymentCallback(onSuccess, onFailure),
        ),
        onFailure,
    )

    override fun confirm(
        paymentIntentId: String,
        onSuccess: (String) -> Unit,
        onFailure: () -> Unit,
    ): NativeCancelable = cancelable(
        Terminal.getInstance().confirmPaymentIntent(
            paymentIntent(paymentIntentId),
            paymentCallback(onSuccess, onFailure),
        ),
        onFailure,
    )

    private fun paymentIntent(id: String) = requireNotNull(lastPaymentIntent).takeIf { it.id == id }
        ?: throw IllegalStateException("Terminal PaymentIntent context changed")

    private fun paymentCallback(onSuccess: (String) -> Unit, onFailure: () -> Unit) = object : PaymentIntentCallback {
        override fun onSuccess(paymentIntent: com.stripe.stripeterminal.external.models.PaymentIntent) {
            lastPaymentIntent = paymentIntent
            onSuccess(requireNotNull(paymentIntent.id))
        }
        override fun onFailure(e: TerminalException) = onFailure()
    }

    private fun cancelable(delegate: Cancelable, onTerminalCallback: () -> Unit): NativeCancelable = NativeCancelable {
        delegate.cancel(object : Callback {
            override fun onSuccess() = onTerminalCallback()
            override fun onFailure(e: TerminalException) = onTerminalCallback()
        })
    }

    private fun readerKey(reader: Reader): String = discoveredReaderKey(
        reader.id, reader.serialNumber.orEmpty(), reader.deviceType.toString().lowercase(), expectedReaderId,
    )

    private fun connectedReader(reader: Reader) = ConnectedReader(
        readerKey(reader),
        reader.serialNumber.orEmpty(),
        reader.deviceType.toString().lowercase(),
        reader.location?.id.orEmpty(),
    )

    private var lastPaymentIntent: com.stripe.stripeterminal.external.models.PaymentIntent? = null

    private companion object {
        val processLock = Any()
        val connectionTokens = RotatingConnectionTokenProvider()
        var initialized = false
    }
}
