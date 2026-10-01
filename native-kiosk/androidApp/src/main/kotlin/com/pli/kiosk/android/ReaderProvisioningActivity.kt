package com.pli.kiosk.android

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

data class ReaderProvisioningConfiguration(
    val approvedOrigin: String,
    val enabled: Boolean,
    val collectionEnabled: Boolean,
    val oneTimeConnectionToken: String,
) {
    init {
        require(!enabled || !collectionEnabled) { "Provisioning and collection are mutually exclusive" }
        if (enabled || approvedOrigin.isNotBlank()) ApprovedOrigin(approvedOrigin)
        require(!enabled || oneTimeConnectionToken.startsWith("pst_")) { "A one-time Stripe connection token is required" }
    }

    companion object {
        fun fromBuildConfig() = ReaderProvisioningConfiguration(
            BuildConfig.APPROVED_HTTPS_ORIGIN,
            BuildConfig.READER_PROVISIONING_ENABLED,
            BuildConfig.NATIVE_COLLECTION_ENABLED,
            BuildConfig.PROVISIONING_CONNECTION_TOKEN,
        )
    }
}

class OneTimeConnectionToken(token: String) {
    private var value: String? = token
    @Synchronized fun consume(): String = requireNotNull(value) { "Provisioning connection token was already consumed" }
        .also { value = null }
}

enum class ReaderProvisioningState { READY, DISCOVERING, READER_FOUND, CONNECTING, CONNECTED, BLOCKED }
data class ReaderProvisioningSnapshot(val state: ReaderProvisioningState, val readerId: String? = null)

class ReaderProvisioningController(
    private val terminal: NativeTerminalAdapter,
    private val permissions: BluetoothPermissions,
    private val token: OneTimeConnectionToken,
    private val notify: (ReaderProvisioningSnapshot) -> Unit = {},
) {
    private var selected: ConnectedReader? = null
    private var discovery: NativeCancelable? = null
    var snapshot = ReaderProvisioningSnapshot(ReaderProvisioningState.READY); private set

    @Synchronized fun initialize() = terminal.initialize(token::consume)

    @Synchronized fun discover() {
        if (!permissions.hasBluetoothPermissions()) {
            permissions.requestBluetoothPermissions()
            publish(ReaderProvisioningState.BLOCKED)
            return
        }
        selected = null
        discovery?.cancel()
        publish(ReaderProvisioningState.DISCOVERING)
        discovery = terminal.discover(BluetoothDiscoveryRequest(10_000, false), { readers -> synchronized(this) {
            val matches = readers.filter {
                it.serial == Approved.M2_SERIAL && it.type == "stripe_m2" && it.id.matches(Regex("tmr_[A-Za-z0-9]+"))
            }
            selected = matches.singleOrNull()
            publish(if (selected == null) ReaderProvisioningState.BLOCKED else ReaderProvisioningState.READER_FOUND, selected?.id)
        } }, { synchronized(this) { selected = null; publish(ReaderProvisioningState.BLOCKED) } })
    }

    @Synchronized fun connect(): Boolean {
        val reader = selected ?: return false
        if (snapshot.state != ReaderProvisioningState.READER_FOUND) return false
        discovery?.cancel(); discovery = null
        publish(ReaderProvisioningState.CONNECTING, reader.id)
        terminal.connect(reader, BluetoothConnectionRequest(Approved.LOCATION, false),
            onDisconnect = { synchronized(this) { selected = null; publish(ReaderProvisioningState.BLOCKED) } },
            onSuccess = { synchronized(this) {
                val observed = terminal.observedReaderId()
                if (observed == reader.id) publish(ReaderProvisioningState.CONNECTED, observed)
                else { terminal.disconnect(); selected = null; publish(ReaderProvisioningState.BLOCKED) }
            } },
            onFailure = { synchronized(this) { selected = null; publish(ReaderProvisioningState.BLOCKED) } },
        )
        return true
    }

    @Synchronized fun close() { discovery?.cancel(); discovery = null; terminal.disconnect() }

    private fun publish(state: ReaderProvisioningState, readerId: String? = null) {
        snapshot = ReaderProvisioningSnapshot(state, readerId)
        notify(snapshot)
    }
}

/** One-time LIVE reader bootstrap. It has no web login, payment, attempt, or student surface. */
class ReaderProvisioningActivity : Activity() {
    private val main = Handler(Looper.getMainLooper())
    private lateinit var discover: Button
    private lateinit var connect: Button
    private lateinit var status: TextView
    private var controller: ReaderProvisioningController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val config = runCatching(ReaderProvisioningConfiguration::fromBuildConfig).getOrNull()
        if (config?.enabled != true) { finish(); return }
        val permissions = AndroidBluetoothPermissions(this).also { it.attach(this) }
        controller = ReaderProvisioningController(
            StripeTerminalSdkAdapter(this), permissions, OneTimeConnectionToken(config.oneTimeConnectionToken),
        ) { value -> main.post { render(value) } }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val padding = (16 * resources.displayMetrics.density).toInt(); setPadding(padding, padding, padding, padding)
            status = TextView(context).apply { text = "Payments are disabled. Initializing one-time LIVE provisioning." }
            discover = Button(context).apply { text = "Discover LIVE M2"; isEnabled = false; setOnClickListener { controller?.discover() } }
            connect = Button(context).apply { text = "Connect to PLI — Escuela"; isEnabled = false; setOnClickListener { controller?.connect() } }
            addView(discover); addView(connect); addView(status, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        })
        runCatching { controller!!.initialize() }
            .onSuccess { discover.isEnabled = true; status.text = "Ready. Discover the physical M2; no web login is involved." }
            .onFailure { status.text = "Provisioning initialization failed closed." }
    }

    private fun render(value: ReaderProvisioningSnapshot) {
        connect.isEnabled = value.state == ReaderProvisioningState.READER_FOUND
        discover.isEnabled = value.state !in setOf(ReaderProvisioningState.CONNECTING, ReaderProvisioningState.CONNECTED)
        status.text = when (value.state) {
            ReaderProvisioningState.CONNECTED -> "Provisioned LIVE reader ${value.readerId}. Record this ID; no payment was created."
            ReaderProvisioningState.READER_FOUND -> "Exact M2 found as ${value.readerId}. Connect explicitly."
            ReaderProvisioningState.DISCOVERING -> "Discovering exact serial ${Approved.M2_SERIAL}…"
            ReaderProvisioningState.CONNECTING -> "Connecting to ${Approved.LOCATION} with automatic reconnect disabled…"
            ReaderProvisioningState.BLOCKED -> "Provisioning blocked. Check permission, exact M2, and retry explicitly."
            ReaderProvisioningState.READY -> "Ready."
        }
    }

    override fun onStop() { controller?.close(); super.onStop() }
}
