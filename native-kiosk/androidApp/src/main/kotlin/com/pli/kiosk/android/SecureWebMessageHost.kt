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

    fun handle(sourceOrigin: String?, isMainFrame: Boolean, currentUrl: String?, data: String?): String? {
        if (invalidated || data == null || !admission.acceptsMessage(sourceOrigin, isMainFrame, currentUrl)) return null
        return reply(bridge.dispatch(data))
    }

    fun invalidate() {
        if (!invalidated) bridge.invalidate()
        invalidated = true
    }

    private fun reply(response: SecureBridgeResponse): String = when {
        response.operationRef != null && response.state != null -> "{\"requestId\":${json(response.requestId)},\"operationRef\":${json(response.operationRef)},\"state\":${json(response.state.name.lowercase())}}"
        else -> "{\"requestId\":${json(response.requestId)},\"error\":${json((response.error ?: SecureBridgeError.INTERNAL_ERROR).name.lowercase())}}"
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
    private val featureAvailable: Boolean = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER),
) {
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
        if (attached && featureAvailable) WebViewCompat.removeWebMessageListener(webView, OBJECT_NAME)
        attached = false
    }

    private val listener = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, replyProxy ->
        adapter?.handle(sourceOrigin.toString(), isMainFrame, webView.url, message.data)?.let { reply(replyProxy, it) }
    }

    private fun reply(proxy: JavaScriptReplyProxy, value: String) = proxy.postMessage(value)

    companion object {
        const val OBJECT_NAME = "pliNativeBridge"
        fun canAttach(admission: SecureWebAdmission?, collectionEnabled: Boolean, featureAvailable: Boolean, bridge: SecureWebBridge?) =
            admission != null && collectionEnabled && featureAvailable && bridge != null
    }
}
