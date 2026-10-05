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

    fun capture(completedUrl: String?, currentTopLevelUrl: String?): Boolean {
        if (completedUrl != terminalUrl || currentTopLevelUrl != terminalUrl) return false
        return runCatching {
            val existing = store.read()
            if (existing.attempt != null) false
            else {
                val rawCookie = cookieReader.readCookie(terminalUrl) ?: return@runCatching false
                val session = transport.importBrowserSession(rawCookie)
                if (matchesFreshPersistedSession(existing.session, session)) true
                else {
                    coordinator.login { session }
                    store.read() == DurableState(session)
                }
            }
        }.getOrDefault(false).also { if (it) ready = true }
    }

    private fun matchesFreshPersistedSession(existing: StaffSession?, imported: StaffSession): Boolean =
        existing != null &&
            existing.origin == imported.origin &&
            existing.association == imported.association &&
            existing.cookie == imported.cookie &&
            existing.expiresAt > clock()
}
