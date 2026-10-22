package com.pli.kiosk.android

import android.webkit.CookieManager

/** Native-only source for the WebView cookie; it never accepts JavaScript-supplied values. */
fun interface BrowserCookieReader {
    fun readCookie(url: String): String?
}

object CookieManagerBrowserCookieReader : BrowserCookieReader {
    override fun readCookie(url: String): String? = CookieManager.getInstance().getCookie(url)
}

/**
 * Captures the original browser session only after exact top-level terminal completion. Readiness
 * means the encrypted state was written and read back; it is not server-authentication proof.
 */
class WebSessionReadiness(
    private val origin: ApprovedOrigin,
    private val store: StateStore,
    private val transport: StaffSessionTransport,
    private val cookieReader: BrowserCookieReader,
    private val clock: () -> Long,
    preparedApi: PreparedPurchaseApi? = null,
    private val backgroundExecutor: OperatorBackgroundExecutor = DirectOperatorBackgroundExecutor,
    private val onRecoveryReady: () -> Boolean = { true },
    private val onRecoveryStage: (RetainedRecoveryStage) -> Unit = {},
) {
    private val purchaseApi = StaffSessionPurchaseApi(transport)
    private val preparedApi = preparedApi ?: purchaseApi
    private val coordinator = PurchaseCoordinator(origin, store, purchaseApi, clock, this.preparedApi)
    private val terminalUrl = "${origin.value}/staff/terminal"

    var ready: Boolean = false
        private set
    private var capturedSession: StaffSession? = null
    private var startupRecoveryAttempted = false
    private var startupRecoveryFailed = false

    fun capture(completedUrl: String?, currentTopLevelUrl: String?): Boolean {
        if (completedUrl != terminalUrl || currentTopLevelUrl != terminalUrl ||
            startupRecoveryFailed || startupRecoveryAttempted
        ) return false
        return runCatching {
            val existing = rollOverResolvedPreparedAttempt(store.read())
            if (existing.attempt != null) {
                scheduleRetainedPreparedRecovery(existing)
                return@runCatching null
            }
            val rawCookie = cookieReader.readCookie(terminalUrl) ?: return@runCatching null
            val imported = transport.importBrowserSession(rawCookie)
            val admitted = if (matchesFreshPersistedSession(existing.session, imported)) existing.session
            else {
                coordinator.login { imported }
                store.read().takeIf { it.attempt == null && it.session == imported }?.session
            }
            admitted?.takeIf(::isCurrentApprovedSession)
        }.getOrNull()?.also {
            capturedSession = it
            ready = true
        } != null
    }

    /** Re-reads encrypted state so readiness cannot outlive its exact captured session. */
    fun currentSession(): StaffSession? = runCatching {
        val captured = capturedSession ?: return@runCatching null
        val state = store.read()
        state.session?.takeIf { state.attempt == null && it == captured && isCurrentApprovedSession(it) }
    }.getOrNull()

    private fun scheduleRetainedPreparedRecovery(original: DurableState) {
        val knownPayment = isRecoverableKnownPreparedAttempt(original)
        val ticketOnly = isRecoverableTicketOnlyPreparedAttempt(original)
        if (startupRecoveryAttempted || (!knownPayment && !ticketOnly)) {
            report(RetainedRecoveryStage.INELIGIBLE)
            return
        }
        startupRecoveryAttempted = true
        val retainedSession = requireNotNull(original.session)
        val rawCookie = cookieReader.readCookie(terminalUrl) ?: run {
            report(RetainedRecoveryStage.SESSION_REJECTED)
            return
        }
        val imported = runCatching { transport.importBrowserSession(rawCookie) }.getOrNull() ?: run {
            report(RetainedRecoveryStage.SESSION_REJECTED)
            return
        }
        if (imported.origin != retainedSession.origin ||
            imported.association != retainedSession.association ||
            imported.cookie != retainedSession.cookie
        ) {
            report(RetainedRecoveryStage.SESSION_REJECTED)
            return
        }

        report(RetainedRecoveryStage.SCHEDULED)
        try {
            backgroundExecutor.execute {
                val cleared = if (knownPayment) recoverRetainedPreparedAttempt(original, imported)
                else recoverUncreatedTicketOnlyAttempt(original, imported)
                if (cleared) {
                    val ownerAccepted = runCatching(onRecoveryReady).getOrDefault(false)
                    if (ownerAccepted) report(RetainedRecoveryStage.RELOAD_REQUESTED)
                    else {
                        startupRecoveryFailed = true
                        report(RetainedRecoveryStage.FAILED)
                        restoreOriginalState(original)
                    }
                }
            }
        } catch (_: Exception) {
            startupRecoveryFailed = true
            report(RetainedRecoveryStage.FAILED)
        }
    }

    private fun recoverRetainedPreparedAttempt(original: DurableState, imported: StaffSession): Boolean {
        val renewed = original.copy(session = imported)
        return try {
            store.write(renewed)
            require(store.read() == renewed) { "Renewed session was not durable" }
            report(RetainedRecoveryStage.SESSION_RENEWED)
            when (coordinator.recoverKnownPreparedAttemptForStartup()) {
                Outcome.PAID -> {
                    report(RetainedRecoveryStage.SERVER_PAID)
                    commitPaidRollover(imported).also { committed ->
                        if (committed) report(RetainedRecoveryStage.PAID_COMMITTED)
                    }
                }
                Outcome.PENDING, Outcome.DISABLED -> {
                    report(RetainedRecoveryStage.SERVER_PENDING)
                    false
                }
            }
        } catch (_: Exception) {
            startupRecoveryFailed = true
            report(RetainedRecoveryStage.FAILED)
            restoreOriginalState(original)
            false
        }
    }

    /** UNCREATED is narrow negative authority, never a payment or reader recovery result. */
    private fun recoverUncreatedTicketOnlyAttempt(original: DurableState, imported: StaffSession): Boolean {
        val ticket = original.attempt?.ticket
        return try {
            require(isRecoverableTicketOnlyPreparedAttempt(original) && ticket != null) {
                "Startup creation-status requires one ticket-only prepared attempt"
            }
            require(store.read() == original) { "Retained attempt changed before creation-status" }
            when (preparedApi.preparedCreationStatus(imported, ticket)) {
                PreparedCreationStatus.CREATED -> throw IllegalStateException("PaymentIntent creation is already known")
                PreparedCreationStatus.UNCREATED -> {
                    require(store.read() == original) { "Retained attempt changed during creation-status" }
                    requireCurrentBrowserSession(imported)
                    val cleared = DurableState(imported)
                    store.write(cleared)
                    require(store.read() == cleared) { "Uncreated rollover was not durable" }
                    requireCurrentBrowserSession(imported)
                    true
                }
            }
        } catch (_: Exception) {
            startupRecoveryFailed = true
            report(RetainedRecoveryStage.FAILED)
            restoreOriginalState(original)
            false
        }
    }

    private fun requireCurrentBrowserSession(expected: StaffSession) {
        val rawCookie = requireNotNull(cookieReader.readCookie(terminalUrl)) {
            "Browser session disappeared during creation-status"
        }
        val current = transport.importBrowserSession(rawCookie)
        require(current.origin == expected.origin &&
            current.association == expected.association &&
            current.cookie == expected.cookie
        ) { "Browser session changed during creation-status" }
    }

    private fun commitPaidRollover(session: StaffSession): Boolean {
        val cleared = DurableState(session)
        return try {
            store.write(cleared)
            true
        } catch (failure: Exception) {
            // Some stores can report a post-commit verification error. Fresh server Paid already
            // authorizes this exact empty target; no other observed state is accepted as success.
            if (runCatching { store.read() == cleared }.getOrDefault(false)) true else throw failure
        }
    }

    private fun report(stage: RetainedRecoveryStage) {
        runCatching { onRecoveryStage(stage) }
    }

    private fun isRecoverableKnownPreparedAttempt(state: DurableState): Boolean =
        isRecoverablePreparedAttempt(state) && !state.attempt?.paymentIntentId.isNullOrBlank()

    private fun isRecoverableTicketOnlyPreparedAttempt(state: DurableState): Boolean =
        isRecoverablePreparedAttempt(state) && state.attempt?.paymentIntentId == null

    private fun isRecoverablePreparedAttempt(state: DurableState): Boolean {
        val session = state.session ?: return false
        val attempt = state.attempt ?: return false
        val ticket = attempt.ticket ?: return false
        return session.origin == origin.value && session.association.isNotBlank() && session.cookie.isNotBlank() &&
            attempt.mode == AttemptMode.PREPARED && !attempt.resolved &&
            attempt.origin == session.origin && attempt.sessionAssociation == session.association &&
            ticket.value.isNotBlank() && ticket.readerId.isNotBlank() &&
            ticket.locationId == Approved.LOCATION && ticket.expiresAt > 0L
    }

    private fun restoreOriginalState(original: DurableState) {
        runCatching {
            store.write(original)
            require(store.read() == original) { "Original durable state could not be restored" }
        }
    }

    private fun rollOverResolvedPreparedAttempt(state: DurableState): DurableState {
        val attempt = state.attempt ?: return state
        if (attempt.mode != AttemptMode.PREPARED || !attempt.resolved) return state
        coordinator.clearResolvedPreparedAttempt()
        return try {
            store.read().also {
                require(it.session == state.session && it.attempt == null) { "Resolved prepared rollover was not durable" }
            }
        } catch (failure: Exception) {
            try {
                store.write(state)
            } catch (rollbackFailure: Exception) {
                failure.addSuppressed(rollbackFailure)
            }
            throw failure
        }
    }

    private fun isCurrentApprovedSession(session: StaffSession) =
        session.origin == origin.value && session.expiresAt > clock()

    private fun matchesFreshPersistedSession(existing: StaffSession?, imported: StaffSession): Boolean =
        existing != null &&
            existing.origin == imported.origin &&
            existing.association == imported.association &&
            existing.cookie == imported.cookie &&
            isCurrentApprovedSession(existing)
}
