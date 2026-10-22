package com.pli.kiosk.android

import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/** Exact-origin, exact-target admission policy kept independent of WebView callbacks. */
class SecureWebAdmission private constructor(val origin: String) {
    val terminalUrl = "$origin/staff/terminal"

    fun allowsMainFrameNavigation(url: String?, isRedirect: Boolean) = !isRedirect && url == terminalUrl

    fun shouldOverrideNavigation(url: String?, isRedirect: Boolean, isMainFrame: Boolean) =
        isMainFrame && !allowsMainFrameNavigation(url, isRedirect)

    fun acceptsMessage(sourceOrigin: String?, isMainFrame: Boolean, currentUrl: String?) =
        sourceOrigin == origin && isMainFrame && allowsMainFrameNavigation(currentUrl, isRedirect = false)

    companion object {
        fun from(value: String): SecureWebAdmission? = runCatching { ApprovedOrigin(value).value }
            .getOrNull()
            ?.let(::SecureWebAdmission)
    }
}

/** Converts only an admitted bridge result into the closed JavaScript reply schema. */
class SecureWebMessageAdapter(
    private val admission: SecureWebAdmission,
    private val bridge: SecureWebBridge,
) {
    private var invalidated = false
    private val webStates = setOf(SecureBridgeState.ACCEPTED, SecureBridgeState.PENDING, SecureBridgeState.REJECTED)

    fun handle(sourceOrigin: String?, isMainFrame: Boolean, currentUrl: String?, data: String?): String? {
        if (invalidated || data == null || !admission.acceptsMessage(sourceOrigin, isMainFrame, currentUrl)) return null
        return reply(bridge.dispatch(data))
    }

    fun invalidate() {
        if (!invalidated) bridge.invalidate()
        invalidated = true
    }

    /** A response is emitted only when it is accepted by the web closed-envelope parser. */
    private fun reply(response: SecureBridgeResponse): String? {
        val operation = response.operation ?: return null
        val state = response.state?.takeIf {
            it in webStates || it == SecureBridgeState.PAID && operation == PreparedBridgeOperations.POLL
        } ?: return null
        val operationRef = response.operationRef ?: return null
        return "{\"version\":1,\"operation\":${json(operation)},\"requestId\":${json(response.requestId)},\"payload\":{\"operationReference\":${json(operationRef)},\"state\":${json(state.name.lowercase())}}}"
    }

    private fun json(value: String?): String {
        if (value == null) return "null"
        return buildString {
            append('\"')
            value.forEach { character -> when (character) {
                '\\' -> append("\\\\")
                '\"' -> append("\\\"")
                '\b' -> append("\\b")
                '\u000C' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (character < ' ') append("\\u%04x".format(character.code)) else append(character)
            } }
            append('\"')
        }
    }
}

/** AndroidX WebKit adapter. It cannot expose a bridge until every admission gate is true. */
class SecureWebMessageHost(
    private val webView: WebView,
    private val admission: SecureWebAdmission,
    collectionEnabled: Boolean,
    bridge: SecureWebBridge?,
    private val events: NativeWebEvents? = null,
    private val featureAvailable: Boolean = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER),
) {
    private val mainThread = android.os.Handler(android.os.Looper.getMainLooper())
    private val pushTarget = events?.let { channel ->
        HostBoundWebEventTarget<JavaScriptReplyProxy>(channel, { task -> mainThread.post(task) }) { proxy, event -> reply(proxy, event) }
    }
    private val adapter = bridge?.let { SecureWebMessageAdapter(admission, it) }
    private val enabled = canAttach(admission, collectionEnabled, featureAvailable, bridge)
    private var attached = false
    private var invalidated = false

    fun attach(): Boolean {
        if (!enabled || invalidated || attached) return false
        WebViewCompat.addWebMessageListener(webView, OBJECT_NAME, setOf(admission.origin), listener)
        attached = true
        return true
    }

    fun invalidate() {
        if (invalidated) return
        invalidated = true
        adapter?.invalidate()
        pushTarget?.invalidate()
        if (attached && featureAvailable) WebViewCompat.removeWebMessageListener(webView, OBJECT_NAME)
        attached = false
    }

    private val listener = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, replyProxy ->
        val response = adapter?.handle(sourceOrigin.toString(), isMainFrame, webView.url, message.data) ?: return@WebMessageListener
        reply(replyProxy, response)
        // Only an admitted message may become the push target; pushes hop to the UI thread.
        pushTarget?.bindProxy(replyProxy)
    }

    private fun reply(proxy: JavaScriptReplyProxy, value: String) = proxy.postMessage(value)

    companion object {
        const val OBJECT_NAME = "pliNativeBridge"
        fun canAttach(admission: SecureWebAdmission?, collectionEnabled: Boolean, featureAvailable: Boolean, bridge: SecureWebBridge?) =
            admission != null && collectionEnabled && featureAvailable && bridge != null
    }
}

/**
 * The push edge of exactly one host/WebView lifetime. Every push hops to [schedule] (the UI thread in
 * production) and re-checks this host's validity there immediately before delivery, so nothing reaches
 * a reply proxy after [invalidate]. Invalidation unbinds only this target from the shared channel.
 */
internal class HostBoundWebEventTarget<P : Any>(
    private val events: NativeWebEvents,
    private val schedule: (Runnable) -> Unit,
    private val deliver: (P, String) -> Unit,
) : NativeWebEventTarget {
    @Volatile private var proxy: P? = null
    @Volatile private var valid = true

    fun bindProxy(next: P) {
        if (!valid) return
        proxy = next
        events.bind(this)
    }

    override fun post(message: String) = schedule(Runnable {
        val current = proxy
        if (valid && current != null) deliver(current, message)
    })

    fun invalidate() {
        valid = false
        proxy = null
        events.unbind(this)
    }
}
