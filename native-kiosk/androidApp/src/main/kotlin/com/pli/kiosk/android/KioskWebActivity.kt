package com.pli.kiosk.android

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/** Minimal lifecycle boundary between exact web admission and an attached native bridge host. */
internal interface KioskWebHost {
    fun attach(): Boolean
    fun invalidate()
}

/** Context callbacks are delivered only while this controller owns an attached host. */
internal interface KioskWebHostContext {
    val bridge: SecureWebBridge? get() = null
    fun attachPermissionOwner() = Unit
    fun onBluetoothPermissionResult(granted: Boolean)
    fun onApplicationBackgrounded()
    fun onSessionInvalidated()
    fun onReaderInvalidated()
    fun invalidate()
}

/** A terminal completion can request one reload so AndroidX injects the already attached listener. */
internal enum class KioskWebPageResult { IGNORED, RELOAD_REQUIRED, BRIDGE_ACTIVE, REJECTED }

/**
 * Pure admission/lifecycle policy. A terminal controller never creates a replacement bridge;
 * navigation or lifecycle replacement requires a newly-created Activity instead.
 */
internal class KioskWebHostLifecycle(
    private val admission: SecureWebAdmission,
    private val captureSession: (String?, String?) -> Boolean,
    private val currentSession: () -> StaffSession?,
    private val createContext: () -> KioskWebHostContext?,
    private val createHost: (KioskWebHostContext) -> KioskWebHost,
) {
    private var context: KioskWebHostContext? = null
    private var host: KioskWebHost? = null
    private var awaitingReload = false
    private var awaitingSession: StaffSession? = null
    private var active = false
    private var terminal = false

    fun onResume() = Unit

    fun onPageFinished(completedUrl: String?, currentTopLevelUrl: String?): KioskWebPageResult {
        if (terminal) return KioskWebPageResult.REJECTED
        val exactCompletion = KioskWebActivity.isExactTerminalCompletion(admission, completedUrl, currentTopLevelUrl)
        if (active) {
            if (exactCompletion) return KioskWebPageResult.BRIDGE_ACTIVE
            invalidate(KioskWebHostContext::onSessionInvalidated)
            return KioskWebPageResult.REJECTED
        }
        if (awaitingReload && !exactCompletion) {
            invalidate(KioskWebHostContext::onSessionInvalidated)
            return KioskWebPageResult.REJECTED
        }
        if (awaitingReload) {
            if (!runCatching { awaitingSession != null && captureSession(completedUrl, currentTopLevelUrl) &&
                    currentSession() == awaitingSession }.getOrDefault(false)) {
                invalidate(KioskWebHostContext::onSessionInvalidated)
                return KioskWebPageResult.REJECTED
            }
            awaitingReload = false
            awaitingSession = null
            active = true
            return KioskWebPageResult.BRIDGE_ACTIVE
        }
        if (!exactCompletion) return KioskWebPageResult.IGNORED
        if (!captureSession(completedUrl, currentTopLevelUrl)) return KioskWebPageResult.IGNORED
        val session = currentSession() ?: return KioskWebPageResult.IGNORED
        val created = runCatching(createContext).getOrNull() ?: return failClosed()
        context = created
        return try {
            created.attachPermissionOwner()
            val createdHost = createHost(created)
            host = createdHost
            if (createdHost.attach()) {
                awaitingReload = true
                awaitingSession = session
                KioskWebPageResult.RELOAD_REQUIRED
            } else {
                runCatching { createdHost.invalidate() }
                failClosed(created)
            }
        } catch (_: Throwable) {
            runCatching { host?.invalidate() }
            failClosed(created)
        }
    }

    fun onNavigation(url: String?, isRedirect: Boolean, isMainFrame: Boolean): Boolean {
        val blocked = admission.shouldOverrideNavigation(url, isRedirect, isMainFrame)
        if (blocked || isMainFrame && active) invalidate(KioskWebHostContext::onSessionInvalidated)
        return blocked
    }

    fun onPermissionResult(requestCode: Int, granted: Boolean) {
        if (!terminal && requestCode == BluetoothPermissionRequest.CODE) context?.onBluetoothPermissionResult(granted)
    }

    fun onApplicationBackgrounded() = invalidate(KioskWebHostContext::onApplicationBackgrounded)
    fun onSessionInvalidated() = invalidate(KioskWebHostContext::onSessionInvalidated)
    fun onReaderInvalidated() = invalidate(KioskWebHostContext::onReaderInvalidated)
    fun onDestroy() = invalidate(KioskWebHostContext::invalidate)

    private fun failClosed(created: KioskWebHostContext? = null): KioskWebPageResult {
        terminal = true
        awaitingReload = false
        awaitingSession = null
        active = false
        context = null
        host = null
        runCatching { created?.invalidate() }
        return KioskWebPageResult.REJECTED
    }

    private fun invalidate(event: KioskWebHostContext.() -> Unit) {
        if (terminal) return
        terminal = true
        awaitingReload = false
        awaitingSession = null
        active = false
        val ownedHost = host
        val ownedContext = context
        host = null
        context = null
        ownedHost?.invalidate()
        ownedContext?.event()
    }
}

/** Requests a single Activity replacement after its host has been terminally invalidated. */
internal class KioskWebActivityRecreation {
    private var stopped = false
    private var recreationRequested = false

    fun onStop() {
        stopped = true
    }

    fun onResume(): Boolean {
        if (!stopped || recreationRequested) return false
        recreationRequested = true
        return true
    }
}

/** Dedicated kiosk host for the exact terminal page and its native-only message bridge. */
class KioskWebActivity : Activity() {
    private var webView: WebView? = null
    private var lifecycle: KioskWebHostLifecycle? = null
    private val recreation = KioskWebActivityRecreation()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val admission = SecureWebAdmission.from(BuildConfig.APPROVED_HTTPS_ORIGIN) ?: run { finish(); return }
        val app = application as? KioskApplication ?: run { finish(); return }
        val readiness = app.createWebSessionReadiness(admission)
        val view = WebView(this)
        lifecycle = KioskWebHostLifecycle(
            admission,
            readiness::capture,
            readiness::currentSession,
            {
                app.createPreparedBridgeContext(admission)?.let { prepared ->
                    object : KioskWebHostContext {
                        override val bridge = prepared.bridge
                        override fun attachPermissionOwner() = prepared.attachPermissionOwner(this@KioskWebActivity)
                        override fun onBluetoothPermissionResult(granted: Boolean) =
                            prepared.lifecycleOwner.onBluetoothPermissionResult(granted)
                        override fun onApplicationBackgrounded() = prepared.lifecycleOwner.onApplicationBackgrounded()
                        override fun onSessionInvalidated() = prepared.lifecycleOwner.onSessionInvalidated()
                        override fun onReaderInvalidated() = prepared.lifecycleOwner.onReaderInvalidated()
                        override fun invalidate() = prepared.lifecycleOwner.onSessionInvalidated()
                    }
                }
            },
            { context ->
                val host = SecureWebMessageHost(view, admission, BuildConfig.NATIVE_COLLECTION_ENABLED, context.bridge)
                object : KioskWebHost {
                    override fun attach() = host.attach()
                    override fun invalidate() = host.invalidate()
                }
            },
        )
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
                lifecycle?.onNavigation(request.url.toString(), request.isRedirect, request.isForMainFrame) ?: true

            override fun onPageFinished(view: WebView, url: String?) {
                if (lifecycle?.onPageFinished(url, view.url) == KioskWebPageResult.RELOAD_REQUIRED) view.reload()
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message) = false
        }
        webView = view
        setContentView(view)
        view.loadUrl(admission.terminalUrl)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == BluetoothPermissionRequest.CODE) {
            lifecycle?.onPermissionResult(
                requestCode,
                grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED },
            )
        }
    }

    override fun onStop() {
        lifecycle?.onApplicationBackgrounded()
        recreation.onStop()
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        if (recreation.onResume()) recreate()
    }

    override fun onDestroy() {
        lifecycle?.onDestroy()
        webView?.destroy()
        super.onDestroy()
    }

    companion object {
        internal fun isExactTerminalCompletion(admission: SecureWebAdmission, completedUrl: String?, currentUrl: String?) =
            completedUrl == admission.terminalUrl && currentUrl == admission.terminalUrl
    }
}
