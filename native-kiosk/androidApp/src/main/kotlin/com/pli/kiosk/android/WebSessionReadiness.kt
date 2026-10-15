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
) {
    private val coordinator = PurchaseCoordinator(origin, store, StaffSessionPurchaseApi(transport), clock)
    private val terminalUrl = "${origin.value}/staff/terminal"

    var ready: Boolean = false
        private set
    private var capturedSession: StaffSession? = null

    fun capture(completedUrl: String?, currentTopLevelUrl: String?): Boolean {
        if (completedUrl != terminalUrl || currentTopLevelUrl != terminalUrl) return false
        return runCatching {
            val existing = store.read()
            if (existing.attempt != null) return@runCatching null
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

    private fun isCurrentApprovedSession(session: StaffSession) =
        session.origin == origin.value && session.expiresAt > clock()

    private fun matchesFreshPersistedSession(existing: StaffSession?, imported: StaffSession): Boolean =
        existing != null &&
            existing.origin == imported.origin &&
            existing.association == imported.association &&
            existing.cookie == imported.cookie &&
            isCurrentApprovedSession(existing)
}
