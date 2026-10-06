package com.pli.kiosk.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class PinnedReaderBootstrapTest {
    private val ticket = AttemptTicket("ticket", 1_000L, "tmr_exact", Approved.LOCATION)
    private val exact = ConnectedReader("tmr_exact", Approved.M2_SERIAL, "stripe_m2", Approved.LOCATION)
    private val prepared = AttemptState(ticket, "association", "https://approved.invalid", mode = AttemptMode.PREPARED)

    @Test fun `only an existing prepared attempt can activate bootstrap`() {
        assertThrows(IllegalArgumentException::class.java) {
            PinnedReaderBootstrap(AttemptState(ticket, "association", "https://approved.invalid"), "tmr_exact", FakeRuntime()) {}
        }
    }

    @Test fun `one exact prepared M2 connects and continues once`() {
        val runtime = FakeRuntime()
        var continuations = 0
        val bootstrap = bootstrap(runtime) { continuations++ }

        bootstrap.start()
        runtime.publish(exact)
        runtime.connected(exact)

        assertEquals(PinnedReaderBootstrap.State.READY, bootstrap.state)
        assertEquals(1, runtime.connectCalls)
        assertEquals(1, continuations)
        assertFalse(PinnedReaderBootstrap.State.entries.any { it.name == "PAID" })
    }

    @Test fun `wrong or partial readers and multiple exact readers fail closed`() {
        listOf(
            exact.copy(id = "tmr_wrong"), exact.copy(serial = "wrong"),
            exact.copy(type = "other"), exact.copy(location = "tml_wrong"),
            exact.copy(id = ""),
        ).forEach { candidate ->
            val runtime = FakeRuntime()
            val bootstrap = bootstrap(runtime)
            bootstrap.start()
            runtime.publish(candidate)
            assertRecoveryWithoutConnection(bootstrap, runtime)
        }
        val runtime = FakeRuntime()
        val bootstrap = bootstrap(runtime)
        bootstrap.start()
        runtime.publish(exact, exact.copy())
        assertRecoveryWithoutConnection(bootstrap, runtime)
    }

    @Test fun `a changed discovery list blocks stale connection`() {
        val runtime = FakeRuntime()
        var continuations = 0
        val bootstrap = bootstrap(runtime) { continuations++ }
        bootstrap.start()
        runtime.publish(exact)
        runtime.publish(exact.copy(serial = "changed"))
        runtime.connected(exact)

        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, bootstrap.state)
        assertEquals(1, runtime.connectCalls)
        assertEquals(0, continuations)

        val changed = FakeRuntime()
        val changedBootstrap = bootstrap(changed)
        changedBootstrap.start()
        changed.publish(exact)
        changed.connected(exact.copy(serial = "changed"))
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, changedBootstrap.state)
    }

    @Test fun `duplicate reader and connection callbacks continue only once`() {
        val runtime = FakeRuntime()
        var continuations = 0
        val bootstrap = bootstrap(runtime) { continuations++ }
        bootstrap.start()
        runtime.publish(exact)
        runtime.publish(exact)
        runtime.connected(exact)
        runtime.connected(exact)

        assertEquals(PinnedReaderBootstrap.State.READY, bootstrap.state)
        assertEquals(1, runtime.connectCalls)
        assertEquals(1, continuations)
    }

    @Test fun `one compliant reader permits stable unrelated entries but any later list change recovers`() {
        val unrelated = exact.copy(id = "tmr_unrelated")
        val extra = exact.copy(id = "tmr_extra")
        listOf(
            listOf(exact),
            listOf(exact, unrelated, extra),
            listOf(exact, unrelated.copy(serial = "changed")),
        ).forEach { changedReaders ->
            val runtime = FakeRuntime()
            val bootstrap = bootstrap(runtime)
            bootstrap.start()
            runtime.publish(exact, unrelated)
            runtime.publish(*changedReaders.toTypedArray())
            assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, bootstrap.state)
            assertEquals(1, runtime.connectCalls)
        }

        val stable = FakeRuntime()
        val stableBootstrap = bootstrap(stable)
        stableBootstrap.start()
        stable.publish(exact, unrelated)
        stable.publish(exact, unrelated)
        stable.connected(exact)
        assertEquals(PinnedReaderBootstrap.State.READY, stableBootstrap.state)
    }

    @Test fun `resolved attempts and expiry before or during bootstrap require recovery`() {
        assertThrows(IllegalArgumentException::class.java) {
            bootstrap(FakeRuntime(), attempt = prepared.copy(resolved = true))
        }

        val clock = MutableClock(999)
        val beforeDiscovery = FakeRuntime()
        val expiredBeforeDiscovery = bootstrap(beforeDiscovery, clock = clock::read)
        clock.now = 1_000
        expiredBeforeDiscovery.start()
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, expiredBeforeDiscovery.state)
        assertEquals(0, beforeDiscovery.discoveryCalls)

        clock.now = 999
        val duringDiscoveryUpdate = FakeRuntime()
        val expiringOnUpdate = bootstrap(duringDiscoveryUpdate, clock = clock::read)
        expiringOnUpdate.start()
        duringDiscoveryUpdate.publish(exact)
        clock.now = 1_000
        duringDiscoveryUpdate.publish(exact)
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, expiringOnUpdate.state)

        clock.now = 999
        val duringBootstrap = FakeRuntime()
        var continuations = 0
        val expiring = bootstrap(duringBootstrap, clock = clock::read) { continuations++ }
        expiring.start()
        duringBootstrap.publish(exact)
        clock.now = 1_000
        duringBootstrap.connected(exact)
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, expiring.state)
        assertEquals(0, continuations)
    }

    @Test fun `idle invalidation is terminal and later start does nothing`() {
        val runtime = FakeRuntime(permissionGranted = false)
        val bootstrap = bootstrap(runtime)
        bootstrap.invalidate()
        bootstrap.start()

        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, bootstrap.state)
        assertEquals(0, runtime.permissionRequests)
        assertEquals(0, runtime.discoveryCalls)
    }

    @Test fun `recovery callback is one shot for bootstrap failure`() {
        val runtime = FakeRuntime()
        var recoveries = 0
        val bootstrap = PinnedReaderBootstrap(prepared, "tmr_exact", runtime, { 999 }, { recoveries++ }) {}
        bootstrap.start()
        runtime.failDiscovery()
        bootstrap.invalidate()
        assertEquals(1, recoveries)
    }

    @Test fun `permission grant retries discovery once and denial is terminal`() {
        val granted = FakeRuntime(permissionGranted = false)
        val bootstrap = bootstrap(granted)
        bootstrap.start()
        assertEquals(1, granted.permissionRequests)
        bootstrap.onBluetoothPermissionResult(true)
        bootstrap.onBluetoothPermissionResult(true)
        assertEquals(1, granted.discoveryCalls)

        val denied = FakeRuntime(permissionGranted = false)
        val blocked = bootstrap(denied)
        blocked.start()
        blocked.onBluetoothPermissionResult(false)
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, blocked.state)
        assertEquals(0, denied.discoveryCalls)
    }

    @Test fun `failures invalidation and disconnect never reconnect or continue`() {
        val discoveryFailure = FakeRuntime()
        val failedDiscovery = bootstrap(discoveryFailure)
        failedDiscovery.start()
        discoveryFailure.failDiscovery()
        assertRecoveryWithoutConnection(failedDiscovery, discoveryFailure)

        val connectFailure = FakeRuntime()
        val failedConnect = bootstrap(connectFailure)
        failedConnect.start()
        connectFailure.publish(exact)
        connectFailure.failConnection()
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, failedConnect.state)
        failedConnect.start()
        assertEquals(1, connectFailure.connectCalls)

        val disconnected = FakeRuntime()
        var continuations = 0
        val invalidated = bootstrap(disconnected) { continuations++ }
        invalidated.start()
        disconnected.publish(exact)
        disconnected.disconnected()
        invalidated.invalidate()
        disconnected.connected(exact)
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, invalidated.state)
        assertEquals(1, disconnected.connectCalls)
        assertEquals(0, continuations)
    }

    private fun bootstrap(
        runtime: FakeRuntime,
        attempt: AttemptState = prepared,
        clock: () -> Long = { 999 },
        ready: () -> Unit = {},
    ) = PinnedReaderBootstrap(attempt, "tmr_exact", runtime, clock = clock, onReady = ready)

    private class MutableClock(var now: Long) {
        fun read() = now
    }

    private fun assertRecoveryWithoutConnection(bootstrap: PinnedReaderBootstrap, runtime: FakeRuntime) {
        assertEquals(PinnedReaderBootstrap.State.RECOVERY_REQUIRED, bootstrap.state)
        assertEquals(0, runtime.connectCalls)
    }

    private class FakeRuntime(var permissionGranted: Boolean = true) : PinnedReaderBootstrapRuntime {
        var permissionRequests = 0
        var discoveryCalls = 0
        var connectCalls = 0
        private var readers: ((List<ConnectedReader>) -> Unit)? = null
        private var discoveryFailure: (() -> Unit)? = null
        private var connected: ((ConnectedReader) -> Unit)? = null
        private var disconnected: (() -> Unit)? = null
        private var connectionFailure: (() -> Unit)? = null

        override fun hasBluetoothPermission() = permissionGranted
        override fun requestBluetoothPermission() { permissionRequests++ }
        override fun discover(onReaders: (List<ConnectedReader>) -> Unit, onFailure: () -> Unit) {
            discoveryCalls++; readers = onReaders; discoveryFailure = onFailure
        }
        override fun connect(reader: ConnectedReader, onConnected: (ConnectedReader) -> Unit, onDisconnected: () -> Unit, onFailure: () -> Unit) {
            connectCalls++; connected = onConnected; disconnected = onDisconnected; connectionFailure = onFailure
        }
        fun publish(vararg values: ConnectedReader) = requireNotNull(readers).invoke(values.toList())
        fun failDiscovery() = requireNotNull(discoveryFailure).invoke()
        fun connected(reader: ConnectedReader) = requireNotNull(connected).invoke(reader)
        fun disconnected() = requireNotNull(disconnected).invoke()
        fun failConnection() = requireNotNull(connectionFailure).invoke()
    }
}
