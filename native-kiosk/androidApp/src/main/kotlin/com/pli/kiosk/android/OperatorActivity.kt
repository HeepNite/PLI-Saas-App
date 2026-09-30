package com.pli.kiosk.android

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/** The UI-facing runtime boundary keeps production composition real while tests inject fakes. */
interface OperatorRuntime : StudentSelectionActions {
    /** Only a confirmed unique student may receive a signed ticket. */
    val attemptStartEnabled: Boolean
    /** Reader discovery becomes legal only after the opaque signed ticket is durable. */
    val readerDiscoveryEnabled: Boolean
    /** Discovery results are selectable before, and independently from, reader connection. */
    val readerSelectionEnabled: Boolean
    val readerConnectionEnabled: Boolean
    val collectionControlsEnabled: Boolean
    val recoveryEnabled: Boolean
    /** Lookup is unavailable until a valid original staff session exists and no attempt is retained. */
    val studentLookupEnabled: Boolean
    val discoveredReaders: List<ConnectedReader>
    fun login(slug: String, pin: CharArray)
    fun loginAsync(slug: String, pin: CharArray, complete: (Boolean) -> Unit) = try { login(slug, pin); complete(true) } catch (_: Exception) { complete(false) }
    fun beginAttempt()
    fun beginAttemptAsync(complete: (Boolean) -> Unit) = try { beginAttempt(); complete(true) } catch (_: Exception) { complete(false) }
    fun lookupStudentAsync(phone: String, complete: (StudentLookupResult) -> Unit) = complete(lookupStudent(phone))
    fun discoverReaders()
    fun selectReader(reader: ConnectedReader)
    fun connectSelectedReader()
    fun startCollection()
    fun startCollectionAsync(complete: (Boolean) -> Unit) = try { startCollection(); complete(true) } catch (_: Exception) { complete(false) }
    fun cancelCollection()
    fun recoverPaymentStatus()
    fun recoverPaymentStatusAsync(complete: (Boolean) -> Unit) = try { recoverPaymentStatus(); complete(true) } catch (_: Exception) { complete(false) }
    fun onBluetoothPermissionResult(granted: Boolean)
    fun attachPermissionOwner(activity: Activity)
    fun onApplicationBackgrounded()
    fun onApplicationResumed()
    fun onSessionInvalidated()
    fun onReaderInvalidated()
    fun onContextExpired()
    /** Revalidation is a no-op while the authoritative session/ticket/reader context remains valid. */
    fun revalidateContext() = onContextExpired()
    fun setReaderUpdateListener(listener: (List<ConnectedReader>) -> Unit)
    fun setStateListener(listener: () -> Unit)
}

/** A non-operational runtime is intentional whenever production composition lacks a valid context. */
object DisabledOperatorRuntime : OperatorRuntime {
    override val attemptStartEnabled = false
    override val readerDiscoveryEnabled = false
    override val readerSelectionEnabled = false
    override val readerConnectionEnabled = false
    override val collectionControlsEnabled = false
    override val recoveryEnabled = false
    override val studentLookupEnabled = false
    override val discoveredReaders: List<ConnectedReader> = emptyList()
    override fun login(slug: String, pin: CharArray) {
        pin.fill('\u0000')
        throw IllegalStateException("Staff login is unavailable")
    }
    override fun beginAttempt() = Unit
    override fun lookupStudent(phone: String): StudentLookupResult = StudentLookupResult.Invalid
    override fun confirmSelectedStudent(): MinimumStudentIdentity = error("Collection is unavailable")
    override fun discoverReaders() = Unit
    override fun selectReader(reader: ConnectedReader) = Unit
    override fun connectSelectedReader() = Unit
    override fun startCollection() = Unit
    override fun cancelCollection() = Unit
    override fun recoverPaymentStatus() = Unit
    override fun onBluetoothPermissionResult(granted: Boolean) = Unit
    override fun attachPermissionOwner(activity: Activity) = Unit
    override fun onApplicationBackgrounded() = Unit
    override fun onApplicationResumed() = Unit
    override fun onSessionInvalidated() = Unit
    override fun onReaderInvalidated() = Unit
    override fun onContextExpired() = Unit
    override fun setReaderUpdateListener(listener: (List<ConnectedReader>) -> Unit) = listener(emptyList())
    override fun setStateListener(listener: () -> Unit) = listener()
}

/** Operator controls delegate only to the composed runtime; credentials never enter durable UI state. */
class OperatorActivity : Activity() {
    private var studentSelection: StudentSelectionActions? = null
    private var runtime: OperatorRuntime? = null
    private lateinit var confirmation: TextView
    private lateinit var confirm: Button
    private lateinit var lookup: Button
    private lateinit var beginAttempt: Button
    private lateinit var login: Button
    private var loginInFlight = false
    private var lookupInFlight = false
    private var lookupGeneration = 0L
    private lateinit var status: TextView
    private lateinit var readerChoices: LinearLayout
    private val gatedControls = mutableListOf<Button>()

    /** The authenticated session owner supplies this narrow, fakeable selection seam. */
    fun bindStudentSelection(actions: StudentSelectionActions) {
        studentSelection = actions
        if (::confirmation.isInitialized) {
            confirmation.text = LOOKUP_REQUIRED_MESSAGE
            confirm.isEnabled = false
            updateControlGate()
        }
    }

    /** Tests may bind a fake; production obtains this only from KioskApplication composition. */
    fun bindRuntime(actions: OperatorRuntime) {
        runtime = actions
        actions.attachPermissionOwner(this)
        studentSelection = actions
        if (::confirmation.isInitialized) {
            actions.setReaderUpdateListener(::renderReaders)
            actions.setStateListener(::refreshControlsOnMainThread)
            updateControlGate()
            confirmation.text = LOOKUP_REQUIRED_MESSAGE
            confirm.isEnabled = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runtime = (application as? KioskApplication)?.operatorRuntime ?: runtime
        runtime?.let {
            studentSelection = it
            it.attachPermissionOwner(this)
            it.setStateListener(::refreshControlsOnMainThread)
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }
        status = TextView(this).apply { text = DISABLED_MESSAGE }
        layout.addView(status, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        layout.addView(TextView(this).apply { text = OFFER_MESSAGE }, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        val slug = EditText(this).apply { hint = "Staff slug" }
        val pin = EditText(this).apply {
            hint = "Staff PIN"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }
        layout.addView(slug, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        layout.addView(pin, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        login = Button(this).apply {
            text = "Staff login"
            setOnClickListener {
                if (loginInFlight) return@setOnClickListener
                loginInFlight = true
                isEnabled = false
                val pinBuffer = pin.text.toString().toCharArray()
                pin.text?.clear()
                try {
                    requireNotNull(runtime) { "Staff login is unavailable" }.loginAsync(slug.text.toString(), pinBuffer) { accepted ->
                        // ProductionOperatorRuntime posts this completion to the attached Activity UI thread.
                        loginInFlight = false
                        status.text = if (accepted) LOGIN_SUCCESS_MESSAGE else LOGIN_REJECTED_MESSAGE
                        updateControlGate()
                    }
                } catch (_: Exception) {
                    loginInFlight = false
                    status.text = LOGIN_REJECTED_MESSAGE
                    pinBuffer.fill('\u0000')
                }
                updateControlGate()
            }
        }
        layout.addView(login)
        val phone = EditText(this).apply {
            hint = "Complete student phone"
            inputType = android.text.InputType.TYPE_CLASS_PHONE
        }
        confirmation = TextView(this).apply { text = LOOKUP_REQUIRED_MESSAGE }
        confirm = Button(this).apply {
            text = "Confirm selected student"
            isEnabled = false
            setOnClickListener {
                val selected = runCatching { studentSelection?.confirmSelectedStudent() }.getOrNull()
                if (selected == null) {
                    status.text = CONFIRMATION_REQUIRED_MESSAGE
                    return@setOnClickListener
                }
                confirmation.text = "Student confirmed: ${displayName(selected)}"
                status.text = CONFIRMED_MESSAGE
                isEnabled = false
                updateControlGate()
            }
        }
        layout.addView(phone, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        lookup = Button(this).apply {
            text = "Look up student"
            setOnClickListener {
                val generation = ++lookupGeneration
                lookupInFlight = true
                clearSelection(LOOKUP_REQUIRED_MESSAGE)
                val requestedPhone = phone.text.toString()
                val render: (StudentLookupResult?) -> Unit = render@{ result ->
                    if (generation != lookupGeneration) return@render
                    lookupInFlight = false
                    when (result) {
                        is StudentLookupResult.Unique -> { confirmation.text = "Confirm student: ${displayName(result.student)}"; confirm.isEnabled = true; status.text = LOOKUP_READY_MESSAGE }
                        StudentLookupResult.Missing -> clearSelection("No existing student matches that complete phone.")
                        StudentLookupResult.Invalid -> clearSelection("Enter a valid complete student phone.")
                        StudentLookupResult.Ambiguous -> clearSelection("Student lookup is ambiguous. Reconcile before continuing.")
                        null -> clearSelection(LOOKUP_REQUIRED_MESSAGE)
                    }
                    updateControlGate()
                }
                try {
                    runtime?.lookupStudentAsync(requestedPhone, render)
                        ?: render(runCatching { studentSelection?.lookupStudent(requestedPhone) }.getOrNull())
                } catch (_: Exception) {
                    render(StudentLookupResult.Invalid)
                }
            }
        }
        layout.addView(lookup)
        layout.addView(confirmation, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        layout.addView(confirm)
        beginAttempt = gatedAction("Begin attempt") { requireNotNull(runtime).beginAttemptAsync { updateControlGate() } }
        layout.addView(beginAttempt)
        layout.addView(gatedAction("Discover readers") { runtime?.discoverReaders() })
        if (runtime != null) {
            readerChoices = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            layout.addView(readerChoices, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        layout.addView(gatedAction("Connect selected reader") { runtime?.connectSelectedReader() })
        layout.addView(gatedAction("Start collection") { runtime?.startCollectionAsync { updateControlGate() } })
        layout.addView(gatedAction("Cancel collection") { runtime?.cancelCollection() })
        layout.addView(gatedAction("Recover payment status") { runtime?.recoverPaymentStatusAsync { updateControlGate() } })
        layout.addView(safeAction("Manual BLE reconnect", RECONNECT_MESSAGE) { runtime?.discoverReaders() })
        layout.addView(safeAction("Refresh status", STATUS_MESSAGE) {})
        layout.addView(safeAction("Recover known attempt", RECOVERY_MESSAGE) { runtime?.recoverPaymentStatus() })
        setContentView(layout)
        runtime?.setReaderUpdateListener(::renderReaders)
        runtime?.setStateListener(::refreshControlsOnMainThread)
        updateControlGate()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == BluetoothPermissionRequest.CODE) {
            runtime?.onBluetoothPermissionResult(grantResults.isNotEmpty() && grantResults.all { it == android.content.pm.PackageManager.PERMISSION_GRANTED })
            updateControlGate()
        }
    }

    override fun onStart() {
        super.onStart()
        runtime?.revalidateContext()
        updateControlGate()
    }

    override fun onStop() {
        runtime?.onApplicationBackgrounded()
        super.onStop()
    }

    private fun renderReaders(readers: List<ConnectedReader>) {
        if (!::readerChoices.isInitialized) return
        runOnUiThread {
            readerChoices.removeAllViews()
            readers.forEach { reader ->
                readerChoices.addView(Button(this).apply {
                    text = "Select reader: ${reader.id}"
                    isEnabled = runtime?.readerSelectionEnabled == true
                    setOnClickListener {
                        runCatching { runtime?.selectReader(reader) }
                            .onSuccess { status.text = "Reader selected. Connect explicitly to continue."; updateControlGate() }
                            .onFailure { status.text = PAYMENT_GATE_MESSAGE }
                    }
                })
            }
        }
    }

    private fun updateControlGate() {
        val bound = runtime
        gatedControls.forEach { button ->
            button.isEnabled = when (button.text) {
                "Begin attempt" -> bound?.attemptStartEnabled == true
                "Discover readers" -> bound?.readerDiscoveryEnabled == true
                "Connect selected reader" -> bound?.readerConnectionEnabled == true
                "Start collection" -> bound?.collectionControlsEnabled == true
                "Cancel collection", "Recover payment status" -> bound?.recoveryEnabled == true
                else -> false
            }
        }
        if (::login.isInitialized) login.isEnabled = !loginInFlight
        if (::lookup.isInitialized) lookup.isEnabled = !lookupInFlight && (bound?.studentLookupEnabled ?: (studentSelection != null))
        if (::readerChoices.isInitialized) renderReaders(runtime?.discoveredReaders.orEmpty())
    }

    private fun refreshControlsOnMainThread() {
        if (isFinishing || isDestroyed) return
        runOnUiThread(::updateControlGate)
    }

    private fun clearSelection(message: String) {
        confirmation.text = message
        confirm.isEnabled = false
        status.text = message
        updateControlGate()
    }

    private fun displayName(student: MinimumStudentIdentity): String = student.name?.takeIf(String::isNotBlank)
        ?: "Existing student"

    private fun gatedAction(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        isEnabled = false
        gatedControls += this
        setOnClickListener {
            runCatching(action).onFailure { status.text = PAYMENT_GATE_MESSAGE }
            updateControlGate()
        }
    }

    private fun safeAction(label: String, message: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        setOnClickListener {
            runCatching(action)
                .onSuccess { status.text = message }
                .onFailure { status.text = PAYMENT_GATE_MESSAGE }
            updateControlGate()
        }
    }

    private companion object {
        const val DISABLED_MESSAGE = "Collection disabled. No payment can be created, confirmed, or collected."
        const val OFFER_MESSAGE = "USD 1.00 — one general class credit"
        const val PAYMENT_GATE_MESSAGE = "Payment action is blocked until origin, flag, original session, reader and server context are valid."
        const val RECONNECT_MESSAGE = "Manual reconnect requested. Collection remains disabled."
        const val STATUS_MESSAGE = "Status refresh is read-only. Collection remains disabled."
        const val RECOVERY_MESSAGE = "Known-attempt recovery is read-only. Collection remains disabled."
        const val LOOKUP_REQUIRED_MESSAGE = "Enter a complete phone and use the authenticated staff-session lookup."
        const val CONFIRMATION_REQUIRED_MESSAGE = "A unique student confirmation is required before an attempt. Collection remains disabled."
        const val LOOKUP_READY_MESSAGE = "Confirm the selected student before a signed attempt. Collection remains disabled."
        const val CONFIRMED_MESSAGE = "Student confirmed. Collection remains disabled."
        const val LOGIN_SUCCESS_MESSAGE = "Staff session established. Student lookup is available when no attempt is retained."
        const val LOGIN_REJECTED_MESSAGE = "Staff login was rejected."
    }
}
