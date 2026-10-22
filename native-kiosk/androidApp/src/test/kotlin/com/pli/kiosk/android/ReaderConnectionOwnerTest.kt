package com.pli.kiosk.android

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.Test

class ReaderConnectionOwnerTest {
    private val exact = ConnectedReader(PROVISIONED, Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)

    @Test
    fun `foreground start connects only the exact provisioned reader with sdk auto reconnect and no payment work`() {
        val fixture = Fixture()

        fixture.owner.start()
        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
        fixture.terminal.publishReaders(exact)
        assertEquals(ReaderConnectionOwner.State.CONNECTING, fixture.owner.state)
        fixture.terminal.completeConnection(exact)

        assertEquals(ReaderConnectionOwner.State.READY, fixture.owner.state)
        assertEquals(listOf(ReaderStatus.CONNECTING, ReaderStatus.CONNECTED), fixture.statuses)
        assertTrue(fixture.terminal.lastConnectionRequest!!.autoReconnectOnUnexpectedDisconnect)
        assertEquals(1, fixture.terminal.initializations)
        assertTrue(fixture.terminal.paymentOperations.isEmpty())
    }

    @Test
    fun `an empty in-progress scan update keeps discovering`() {
        val fixture = Fixture()
        fixture.owner.start()

        fixture.terminal.publishReaders()

        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
        assertEquals(0, fixture.terminal.connections)
    }

    @Test
    fun `scan timeout schedules a retry that discovers again`() {
        val fixture = Fixture()
        fixture.owner.start()

        fixture.terminal.failDiscovery()

        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        assertEquals(ReaderStatus.DISCONNECTED, fixture.statuses.last())
        assertEquals(ReaderConnectionOwner.INITIAL_RETRY_MS, fixture.scheduler.pendingRetryDelay())

        fixture.scheduler.fireRetry()

        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
        assertEquals(2, fixture.terminal.discoveries)
    }

    @Test
    fun `retries never give up and back off to the cap`() {
        val fixture = Fixture()
        fixture.owner.start()
        val delays = mutableListOf<Long>()

        repeat(6) {
            fixture.terminal.failDiscovery()
            delays += fixture.scheduler.pendingRetryDelay()
            fixture.scheduler.fireRetry()
        }

        assertEquals(listOf(5_000L, 10_000L, 20_000L, 20_000L, 20_000L, 20_000L), delays)
        assertEquals(7, fixture.terminal.discoveries)
        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
    }

    @Test
    fun `a successful connection resets the backoff`() {
        val fixture = Fixture()
        fixture.owner.start()
        fixture.terminal.failDiscovery(); fixture.scheduler.fireRetry()
        fixture.terminal.failDiscovery(); fixture.scheduler.fireRetry()
        fixture.terminal.publishReaders(exact)
        fixture.terminal.completeConnection(exact)

        fixture.terminal.dropConnection()

        assertEquals(ReaderConnectionOwner.INITIAL_RETRY_MS, fixture.scheduler.pendingRetryDelay())
    }

    @Test
    fun `a hung discovery or connection is bounded by the attempt deadline and retried`() {
        val fixture = Fixture()
        fixture.owner.start()

        fixture.scheduler.fireDeadline()

        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        assertEquals(1, fixture.terminal.discoveryCancels)
        fixture.scheduler.fireRetry()
        fixture.terminal.publishReaders(exact)
        fixture.scheduler.fireDeadline()
        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)

        // The noncancellable late success of the abandoned connect cannot leave a stray link.
        fixture.terminal.completeConnection(exact)
        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        assertEquals(1, fixture.terminal.disconnects)
    }

    @Test
    fun `non matching readers never connect and the scan is retried`() {
        val fixture = Fixture()
        fixture.owner.start()

        fixture.terminal.publishReaders(exact.copy(id = "tmr_other"), exact.copy(serial = "other"))
        fixture.terminal.failDiscovery()

        assertEquals(0, fixture.terminal.connections)
        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
    }

    @Test
    fun `unexpected disconnect reports sdk reconnection and retries when it fails`() {
        val fixture = Fixture()
        fixture.connect()

        fixture.terminal.events!!.onReconnectStarted()
        assertEquals(ReaderConnectionOwner.State.RECONNECTING, fixture.owner.state)
        assertEquals(ReaderStatus.CONNECTING, fixture.statuses.last())
        fixture.terminal.events!!.onReconnectSucceeded()
        assertEquals(ReaderConnectionOwner.State.READY, fixture.owner.state)
        assertEquals(ReaderStatus.CONNECTED, fixture.statuses.last())

        fixture.terminal.events!!.onReconnectStarted()
        fixture.terminal.events!!.onReconnectFailed()
        fixture.terminal.dropConnection()

        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        assertEquals(ReaderStatus.DISCONNECTED, fixture.statuses.last())
        fixture.scheduler.fireRetry()
        fixture.terminal.publishReaders(exact)
        fixture.terminal.completeConnection(exact)
        assertEquals(ReaderConnectionOwner.State.READY, fixture.owner.state)
        assertEquals(2, fixture.terminal.connections)
    }

    @Test
    fun `idle power down or a lease releasing the link triggers the same retry`() {
        val fixture = Fixture()
        fixture.connect()

        fixture.terminal.dropConnection()

        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        assertEquals(1, fixture.scheduler.retries.size)
        fixture.terminal.dropConnection()
        assertEquals(1, fixture.scheduler.retries.size)
    }

    @Test
    fun `background stops cleanly, disconnects, and a pending retry cannot revive it`() {
        val fixture = Fixture()
        fixture.owner.start()
        fixture.terminal.failDiscovery()

        fixture.owner.invalidate()
        fixture.scheduler.fireRetry()

        assertEquals(ReaderConnectionOwner.State.STOPPED, fixture.owner.state)
        assertEquals(1, fixture.terminal.discoveries)
        assertEquals(1, fixture.terminal.disconnects)
        assertEquals(ReaderStatus.DISCONNECTED, fixture.statuses.last())
        fixture.owner.start()
        assertEquals(ReaderConnectionOwner.State.STOPPED, fixture.owner.state)
    }

    @Test
    fun `background after ready disconnects and late events are ignored`() {
        val fixture = Fixture()
        fixture.connect()

        fixture.owner.invalidate()
        fixture.terminal.events?.onReconnectSucceeded()

        assertEquals(ReaderConnectionOwner.State.STOPPED, fixture.owner.state)
        assertEquals(1, fixture.terminal.disconnects)
        assertTrue(fixture.scheduler.retries.isEmpty())
    }

    @Test
    fun `a sale reuses the ready connection without disconnecting it`() {
        val fixture = Fixture()
        fixture.connect()

        fixture.owner.retireDiscovery()

        assertEquals(ReaderConnectionOwner.State.READY, fixture.owner.state)
        assertEquals(0, fixture.terminal.disconnects)
        assertEquals(exact, fixture.terminal.current)
    }

    @Test
    fun `a sale bootstrap supersedes owner discovery and the owner waits out the sale bootstrap`() {
        val fixture = Fixture()
        fixture.owner.start()

        fixture.owner.retireDiscovery()
        fixture.terminal.publishReaders(exact)

        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        assertEquals(1, fixture.terminal.discoveryCancels)
        assertEquals(0, fixture.terminal.connections)
        assertEquals(0, fixture.terminal.disconnects)
        assertTrue(fixture.scheduler.pendingRetryDelay() > PinnedReaderBootstrap.BOOTSTRAP_TIMEOUT_MS)
    }

    @Test
    fun `startup releases an older activity connection and discovers its own`() {
        val terminal = RecordingTerminal().apply { current = exact }
        val fixture = Fixture(terminal)

        fixture.owner.start()

        assertEquals(1, terminal.disconnects)
        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
        assertEquals(1, terminal.discoveries)
    }

    @Test
    fun `reader input requests are forwarded to the page prompt`() {
        val fixture = Fixture()
        fixture.connect()

        fixture.terminal.events!!.onReaderInputRequested()

        assertEquals(1, fixture.inputRequests)
    }

    @Test
    fun `older late connection callback cannot disconnect a newer ready owner`() {
        val physical = PhysicalConnection()
        val old = Fixture(RecordingTerminal(physical))
        val new = Fixture(RecordingTerminal(physical))

        old.owner.start()
        old.terminal.publishReaders(exact)
        old.owner.invalidate()
        new.owner.start()
        new.terminal.publishReaders(exact)
        new.terminal.completeConnection(exact)
        assertEquals(ReaderConnectionOwner.State.READY, new.owner.state)

        old.terminal.completeConnection(exact)

        assertEquals(exact, physical.reader)
        assertEquals(ReaderConnectionOwner.State.READY, new.owner.state)
        assertEquals(0, new.terminal.disconnects)
    }

    @Test
    fun `sdk connected reader reuse requires every provisioned physical field`() {
        assertTrue(reusableWarmReader(exact, PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(null, PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(id = "tmr_wrong"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(serial = "wrong"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(type = "other"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact.copy(location = "tml_wrong"), PROVISIONED, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact, null, Approved.LOCATION))
        assertFalse(reusableWarmReader(exact, PROVISIONED, null))
    }

    @Test
    fun `permission is requested once, a grant resumes discovery, and a denial keeps retrying silently`() {
        val permissions = RecordingPermissions(granted = false)
        val fixture = Fixture(permissions = permissions)

        fixture.owner.start()
        assertEquals(ReaderConnectionOwner.State.PERMISSION_REQUIRED, fixture.owner.state)
        assertEquals(1, permissions.requests)

        fixture.owner.onBluetoothPermissionResult(false)
        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)
        fixture.scheduler.fireRetry()
        assertEquals(1, permissions.requests)
        assertEquals(0, fixture.terminal.discoveries)

        permissions.granted = true
        fixture.scheduler.fireRetry()
        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
        assertEquals(1, fixture.terminal.discoveries)
    }

    @Test
    fun `permission grant while requested resumes discovery once`() {
        val permissions = RecordingPermissions(granted = false)
        val fixture = Fixture(permissions = permissions)
        fixture.owner.start()

        permissions.granted = true
        fixture.owner.onBluetoothPermissionResult(true)
        fixture.owner.onBluetoothPermissionResult(true)

        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
        assertEquals(1, fixture.terminal.discoveries)
    }

    @Test
    fun `token or sdk initialization failure is retried instead of giving up`() {
        val terminal = RecordingTerminal().apply { failInitialization = true }
        val fixture = Fixture(terminal)

        fixture.owner.start()
        assertEquals(ReaderConnectionOwner.State.WAITING_RETRY, fixture.owner.state)

        terminal.failInitialization = false
        fixture.scheduler.fireRetry()
        assertEquals(ReaderConnectionOwner.State.DISCOVERING, fixture.owner.state)
    }

    private inner class Fixture(
        val terminal: RecordingTerminal = RecordingTerminal(),
        permissions: RecordingPermissions = RecordingPermissions(granted = true),
    ) {
        val scheduler = RecordingScheduler()
        val statuses = mutableListOf<ReaderStatus>()
        var inputRequests = 0
        val owner = ReaderConnectionOwner(
            terminal = terminal,
            permissions = permissions,
            connectionTokenProvider = { "connection-token" },
            provisionedReaderId = PROVISIONED,
            locationId = Approved.LOCATION,
            scheduler = scheduler,
            onStatus = { statuses += it },
            onReaderInputRequested = { inputRequests++ },
        )

        fun connect() {
            owner.start()
            terminal.publishReaders(exact)
            terminal.completeConnection(exact)
            check(owner.state == ReaderConnectionOwner.State.READY)
        }
    }

    private class RecordingScheduler : CollectionDeadlineScheduler {
        val retries = mutableListOf<Pair<Long, () -> Unit>>()
        val deadlines = mutableListOf<() -> Unit>()
        override fun schedule(delayMs: Long, task: () -> Unit): NativeCancelable {
            val entry = delayMs to task
            val list: MutableList<*> = if (delayMs == ReaderConnectionOwner.ATTEMPT_TIMEOUT_MS) {
                deadlines += task; deadlines
            } else {
                retries += entry; retries
            }
            return NativeCancelable { if (list === deadlines) deadlines.remove(task) else retries.remove(entry) }
        }
        fun pendingRetryDelay(): Long = retries.single().first
        fun fireRetry() { if (retries.isNotEmpty()) retries.removeAt(0).second() }
        fun fireDeadline() = deadlines.removeAt(0).invoke()
    }

    private class RecordingPermissions(var granted: Boolean) : BluetoothPermissions {
        var requests = 0
        override fun hasBluetoothPermissions() = granted
        override fun requestBluetoothPermissions() { requests++ }
    }

    private class PhysicalConnection(var reader: ConnectedReader? = null)

    private class RecordingTerminal(
        private val physical: PhysicalConnection = PhysicalConnection(),
    ) : NativeTerminalAdapter {
        var initializations = 0
        var failInitialization = false
        var discoveries = 0
        var connections = 0
        var disconnects = 0
        var discoveryCancels = 0
        var lastConnectionRequest: BluetoothConnectionRequest? = null
        var events: NativeReaderEvents? = null
        var current: ConnectedReader?
            get() = physical.reader
            set(value) { physical.reader = value }
        val paymentOperations = mutableListOf<String>()
        private var discoveryUpdate: ((List<ConnectedReader>) -> Unit)? = null
        private var discoveryFailure: (() -> Unit)? = null
        private var connected: (() -> Unit)? = null
        private var expected: ConnectedReader? = null

        override fun initialize(connectionTokenProvider: () -> String) {
            if (failInitialization) error("token unavailable")
            initializations++
        }
        override fun setReaderEvents(listener: NativeReaderEvents?) { events = listener }
        override fun discover(
            request: BluetoothDiscoveryRequest,
            onUpdate: (List<ConnectedReader>) -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            discoveries++
            discoveryUpdate = onUpdate
            discoveryFailure = onFailure
            return NativeCancelable { discoveryCancels++; discoveryUpdate = null; discoveryFailure = null }
        }
        override fun connect(
            reader: ConnectedReader,
            request: BluetoothConnectionRequest,
            onDisconnect: () -> Unit,
            onSuccess: () -> Unit,
            onFailure: () -> Unit,
        ): NativeCancelable {
            connections++
            expected = reader
            lastConnectionRequest = request
            connected = onSuccess
            return NonCancellableTerminalOperation
        }
        override fun currentConnectedReader(): ConnectedReader? = current
        override fun disconnect() {
            disconnects++
            current = null
            events?.onDisconnected()
        }
        override fun retrieve(clientSecret: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            paymentOperations += "retrieve"
            return NonCancellableTerminalOperation
        }
        override fun collect(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            paymentOperations += "collect"
            return NonCancellableTerminalOperation
        }
        override fun confirm(paymentIntentId: String, onSuccess: (String) -> Unit, onFailure: () -> Unit): NativeCancelable {
            paymentOperations += "confirm"
            return NonCancellableTerminalOperation
        }

        fun publishReaders(vararg readers: ConnectedReader) = discoveryUpdate?.invoke(readers.toList())
        fun failDiscovery() = discoveryFailure?.invoke()
        fun completeConnection(reader: ConnectedReader) {
            current = reader
            check(reader == expected)
            connected?.invoke()
        }
        /** SDK reported a final disconnect (power down, out of range, or failed auto-reconnect). */
        fun dropConnection() {
            current = null
            events?.onDisconnected()
        }
    }

    private companion object { const val PROVISIONED = "tmr_exact" }
}
