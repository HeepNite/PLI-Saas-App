package com.pli.kiosk.android

import android.app.Application
import android.content.pm.PackageManager
import android.view.ViewGroup
import android.widget.Button
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class OperatorRuntimeTest {
    @Test
    fun kioskApplicationComposesTheRealProductionRuntimeAndFailsClosedWithoutFreshContext() {
        val app = KioskApplication()
        val terminal = AsyncTerminal()

        val bound = app.composeRuntime(
            NativeCollectionConfiguration("https://approved.invalid", true),
            StaffSession("https://approved.invalid", "session", "cookie", 2_000_000),
            AttemptTicket("ticket", 2_000_000, "tmr_current", Approved.LOCATION),
            terminal,
            ResultPermissions(),
            object : ConnectionTokenSource { override fun connectionToken(session: StaffSession) = "token" },
            object : PaymentRecovery {
                override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String) =
                    RecoveryState.FromServer(PaymentResult(paymentIntentId, "processing", false))
            },
            FakeActions(enabled = true),
            { 1_000_000 },
        )

        assertTrue(bound is ProductionOperatorRuntime)
        assertFalse(bound.collectionControlsEnabled)
    }

    @Test
    fun discoveryUpdatesAsynchronouslyAndAReaderFromAnOlderDiscoveryCannotConnect() {
        val terminal = AsyncTerminal()
        val runtime = runtime(terminal = terminal)
        val current = reader("tmr_current")

        runtime.initialize()
        runtime.discover()
        assertEquals(emptyList(), runtime.discoveredReaders)
        terminal.publish(listOf(current))
        runtime.selectReader(current)
        runtime.discover()

        assertEquals(emptyList(), runtime.discoveredReaders)
        assertFalse(runCatching { runtime.connectSelectedReader() }.isSuccess)
        terminal.publish(listOf(current))
        assertEquals(listOf(current), runtime.discoveredReaders)
        runtime.selectReader(current)
        runtime.connectSelectedReader()
        assertEquals(listOf("tmr_current"), terminal.connects)
    }

    @Test
    fun permissionDenialNeverStartsPhysicalDiscoveryOrConnection() {
        val permissions = ResultPermissions(granted = false)
        val terminal = AsyncTerminal()
        val runtime = runtime(terminal = terminal, permissions = permissions)
        runtime.initialize()

        assertFalse(runCatching { runtime.discover() }.isSuccess)
        assertEquals(1, permissions.requests)
        runtime.onBluetoothPermissionResult(false)

        assertEquals(NativeCollectionState.DISCOVERY_BLOCKED, runtime.state)
        assertEquals(0, terminal.discoveries)
        assertEquals(0, terminal.connects.size)
    }

    @Test
    fun activityDelegatesEnabledControlsAndInvalidatesOnLifecycle() {
        val actions = FakeActions(enabled = true)
        val controller = Robolectric.buildActivity(OperatorActivity::class.java)
        val activity = controller.setup().get()
        activity.bindRuntime(actions)
        val buttons = buttons(activity)

        listOf("Discover readers", "Connect selected reader", "Start collection", "Cancel collection", "Recover payment status").forEach { label ->
            assertTrue(buttons.single { it.text == label }.isEnabled, label)
            buttons.single { it.text == label }.performClick()
        }
        activity.onRequestPermissionsResult(801, emptyArray(), intArrayOf(PackageManager.PERMISSION_DENIED))
        controller.pause().stop()

        assertEquals(listOf("discover", "connect", "start", "cancel", "recover", "permission:false", "background"), actions.calls)
    }

    @Test
    fun loginClearsPinAndEnablesOnlyTheAuthenticatedStudentLookupFlow() {
        val actions = FakeActions(enabled = true, loginRequired = true)
        val activity = Robolectric.buildActivity(OperatorActivity::class.java).setup().get()
        activity.bindRuntime(actions)
        val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
        val fields = (0 until root.childCount).map(root::getChildAt).filterIsInstance<android.widget.EditText>()
        val slug = fields.single { it.hint == "Staff slug" }
        val pin = fields.single { it.hint == "Staff PIN" }
        val phone = fields.single { it.hint == "Complete student phone" }
        val buttons = buttons(activity)

        assertFalse(buttons.single { it.text == "Look up student" }.isEnabled)
        slug.setText("front-desk")
        pin.setText("1234")
        buttons.single { it.text == "Staff login" }.performClick()
        assertEquals("", pin.text.toString())
        phone.setText("+15550000000")
        buttons.single { it.text == "Look up student" }.performClick()
        buttons.single { it.text == "Confirm selected student" }.performClick()
        buttons.single { it.text == "Begin attempt" }.performClick()
        listOf("Discover readers", "Connect selected reader", "Start collection", "Cancel collection", "Recover payment status").forEach {
            buttons.single { button -> button.text == it }.performClick()
        }

        assertEquals(
            listOf("login:front-desk", "lookup:+15550000000", "confirm", "begin", "discover", "connect", "start", "cancel", "recover"),
            actions.calls,
        )
    }

    @Test
    fun studentLookupClearsPriorConfirmationAndIgnoresLateCallbacks() {
        val actions = FakeActions(enabled = true, deferLookups = true)
        val activity = Robolectric.buildActivity(OperatorActivity::class.java).setup().get()
        activity.bindRuntime(actions)
        val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
        val phone = (0 until root.childCount).map(root::getChildAt).filterIsInstance<android.widget.EditText>()
            .single { it.hint == "Complete student phone" }
        val lookup = buttons(activity).single { it.text == "Look up student" }
        val confirm = buttons(activity).single { it.text == "Confirm selected student" }

        phone.setText("+15550000000")
        lookup.performClick()
        assertFalse(lookup.isEnabled)
        assertFalse(confirm.isEnabled)
        actions.completeLookup(0, "First student")
        assertTrue(confirm.isEnabled)

        phone.setText("+15550000001")
        lookup.performClick()
        assertFalse(confirm.isEnabled)
        actions.completeLookup(0, "Stale student")
        assertFalse(confirm.isEnabled)
        actions.completeLookup(1, "Current student")
        assertTrue(confirm.isEnabled)
    }

    @Test
    fun activityKeepsCollectionControlsDisabledUnlessEveryRuntimePreconditionIsMet() {
        val actions = FakeActions(enabled = false)
        val activity = Robolectric.buildActivity(OperatorActivity::class.java).setup().get()
        activity.bindRuntime(actions)

        listOf("Discover readers", "Connect selected reader", "Start collection", "Cancel collection", "Recover payment status").forEach { label ->
            assertFalse(buttons(activity).single { it.text == label }.isEnabled, label)
        }
    }

    private fun buttons(activity: OperatorActivity): List<Button> =
        (activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup)
            .let { root -> (0 until root.childCount).map(root::getChildAt).filterIsInstance<Button>() }

    private fun runtime(
        terminal: AsyncTerminal = AsyncTerminal(),
        permissions: ResultPermissions = ResultPermissions(),
    ) = NativeCollectionRuntime(
        NativeCollectionConfiguration("https://approved.invalid", true),
        StaffSession("https://approved.invalid", "session", "cookie", 2_000_000),
        AttemptTicket("ticket", 2_000_000, "tmr_current", Approved.LOCATION),
        terminal,
        permissions,
        object : ConnectionTokenSource {
            override fun connectionToken(session: StaffSession): String = "token"
        },
        object : PaymentRecovery {
            override fun recover(session: StaffSession, ticket: AttemptTicket, paymentIntentId: String): RecoveryState =
                RecoveryState.FromServer(PaymentResult(paymentIntentId, "processing", false))
        },
        { 1_000_000 },
    )

    private fun reader(id: String) = ConnectedReader(id, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    private class ResultPermissions(var granted: Boolean = true) : BluetoothPermissions {
        var requests = 0
        override fun hasBluetoothPermissions(): Boolean = granted
        override fun requestBluetoothPermissions() { requests++ }
    }

    private class AsyncTerminal : NativeTerminalAdapter {
        var discoveries = 0
        val connects = mutableListOf<String>()
        private var discoveryUpdate: ((List<ConnectedReader>) -> Unit)? = null

        override fun initialize(connectionTokenProvider: () -> String) = Unit
        override fun discover(
            request: BluetoothDiscoveryRequest,
            onUpdate: (List<ConnectedReader>) -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            discoveries++
            discoveryUpdate = onUpdate
            return NativeCancelable {}
        }
        fun publish(readers: List<ConnectedReader>) = requireNotNull(discoveryUpdate).invoke(readers)
        override fun connect(reader: ConnectedReader, request: BluetoothConnectionRequest, onDisconnect: () -> Unit, onSuccess: () -> Unit, onFailure: () -> Unit): NativeCancelable {
            connects += reader.id
            onSuccess()
            return NativeCancelable {}
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable = NativeCancelable {}
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable = NativeCancelable {}
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable = NativeCancelable {}
    }

    private class FakeActions(
        var enabled: Boolean,
        private val loginRequired: Boolean = false,
        private val deferLookups: Boolean = false,
    ) : OperatorRuntime {
        val calls = mutableListOf<String>()
        private val lookupCallbacks = mutableListOf<(StudentLookupResult) -> Unit>()
        private var loggedIn = !loginRequired
        override val attemptStartEnabled: Boolean get() = enabled && loggedIn
        override val readerDiscoveryEnabled: Boolean get() = enabled
        override val readerSelectionEnabled: Boolean get() = enabled
        override val readerConnectionEnabled: Boolean get() = enabled
        override val collectionControlsEnabled: Boolean get() = enabled
        override val recoveryEnabled: Boolean get() = enabled
        override val studentLookupEnabled: Boolean get() = enabled && loggedIn
        override val discoveredReaders: List<ConnectedReader> = emptyList()
        override fun login(slug: String, pin: CharArray) { calls += "login:$slug"; loggedIn = true; pin.fill('\u0000') }
        override fun beginAttempt() { calls += "begin" }
        override fun lookupStudent(phone: String): StudentLookupResult {
            calls += "lookup:$phone"
            return StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student"))
        }
        override fun lookupStudentAsync(phone: String, complete: (StudentLookupResult) -> Unit) {
            calls += "lookup:$phone"
            if (deferLookups) lookupCallbacks += complete
            else complete(StudentLookupResult.Unique(MinimumStudentIdentity("Fixture student")))
        }
        fun completeLookup(index: Int, name: String) =
            lookupCallbacks[index](StudentLookupResult.Unique(MinimumStudentIdentity(name)))
        override fun confirmSelectedStudent(): MinimumStudentIdentity {
            calls += "confirm"
            return MinimumStudentIdentity("Fixture student")
        }
        override fun discoverReaders() { calls += "discover" }
        override fun connectSelectedReader() { calls += "connect" }
        override fun startCollection() { calls += "start" }
        override fun cancelCollection() { calls += "cancel" }
        override fun recoverPaymentStatus() { calls += "recover" }
        override fun onBluetoothPermissionResult(granted: Boolean) { calls += "permission:$granted" }
        override fun attachPermissionOwner(activity: android.app.Activity) = Unit
        override fun onApplicationBackgrounded() { calls += "background" }
        override fun onApplicationResumed() { calls += "resume" }
        override fun onSessionInvalidated() { calls += "session-invalidated" }
        override fun onReaderInvalidated() { calls += "reader-invalidated" }
        override fun onContextExpired() { calls += "context-expired" }
        override fun setReaderUpdateListener(listener: (List<ConnectedReader>) -> Unit) = listener(emptyList())
        override fun setStateListener(listener: () -> Unit) = listener()
        override fun selectReader(reader: ConnectedReader) = Unit
    }
}
