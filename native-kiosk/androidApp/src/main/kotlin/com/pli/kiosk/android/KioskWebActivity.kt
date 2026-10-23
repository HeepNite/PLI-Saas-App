package com.pli.kiosk.android

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/** Minimal lifecycle boundary between exact web admission and an attached native bridge host. */
internal interface KioskWebHost {
    fun attach(): Boolean
    fun invalidate()
    /** Synchronously drops the replaced document's reply proxy; the bridge itself stays attached. */
    fun retireDocument() = Unit
}

/** Context callbacks are delivered only while this controller owns an attached host. */
internal interface KioskWebHostContext {
    val bridge: SecureWebBridge? get() = null
    val webEvents: NativeWebEvents? get() = null
    /** True only when no sale is in flight, so a same-page reload cannot orphan one. */
    fun survivesDocumentReplacement() = false
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
 * navigation or lifecycle replacement requires a newly-created Activity instead. The one exception is
 * an idle reload of the exact terminal page (the web deploy watchdog): the old document is retired
 * synchronously, the bridge and reader stay, and the reload must complete exactly with the same
 * session authority or the host is invalidated.
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
    private var activeSession: StaffSession? = null
    private var reloading = false
    private var active = false
    private var terminal = false

    fun onResume() = Unit

    fun onPageFinished(completedUrl: String?, currentTopLevelUrl: String?): KioskWebPageResult {
        if (terminal) return KioskWebPageResult.REJECTED
        val exactCompletion = KioskWebActivity.isExactTerminalCompletion(admission, completedUrl, currentTopLevelUrl)
        if (active) {
            if (exactCompletion && reloading) {
                if (!runCatching { captureSession(completedUrl, currentTopLevelUrl) &&
                        sameSessionAuthority(currentSession(), activeSession) }.getOrDefault(false)) {
                    invalidate(KioskWebHostContext::onSessionInvalidated)
                    return KioskWebPageResult.REJECTED
                }
                reloading = false
            }
            if (exactCompletion) return KioskWebPageResult.BRIDGE_ACTIVE
            invalidate(KioskWebHostContext::onSessionInvalidated)
            return KioskWebPageResult.REJECTED
        }
        if (awaitingReload && !exactCompletion) {
            invalidate(KioskWebHostContext::onSessionInvalidated)
            return KioskWebPageResult.REJECTED
        }
        if (awaitingReload) {
            if (!runCatching { captureSession(completedUrl, currentTopLevelUrl) &&
                    sameSessionAuthority(currentSession(), awaitingSession) }.getOrDefault(false)) {
                invalidate(KioskWebHostContext::onSessionInvalidated)
                return KioskWebPageResult.REJECTED
            }
            awaitingReload = false
            activeSession = awaitingSession
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

    private fun sameSessionAuthority(current: StaffSession?, captured: StaffSession?): Boolean =
        current != null && captured != null &&
            current.origin == captured.origin &&
            current.association == captured.association &&
            current.cookie == captured.cookie

    /** Main-frame page start (reload included): the previous document is gone before anything else runs. */
    fun onPageStarted(url: String?) {
        if (terminal) return
        runCatching { host?.retireDocument() }
        if (active && !keepsBridgeAcross(url, isRedirect = false)) invalidate(KioskWebHostContext::onSessionInvalidated)
    }

    fun onNavigation(url: String?, isRedirect: Boolean, isMainFrame: Boolean): Boolean {
        val blocked = admission.shouldOverrideNavigation(url, isRedirect, isMainFrame)
        if (blocked) invalidate(KioskWebHostContext::onSessionInvalidated)
        else if (isMainFrame && active) {
            if (keepsBridgeAcross(url, isRedirect)) runCatching { host?.retireDocument() }
            else invalidate(KioskWebHostContext::onSessionInvalidated)
        }
        return blocked
    }

    private fun keepsBridgeAcross(url: String?, isRedirect: Boolean): Boolean {
        if (!admission.allowsMainFrameNavigation(url, isRedirect)) return false
        if (!runCatching { context?.survivesDocumentReplacement() == true }.getOrDefault(false)) return false
        reloading = true
        return true
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
        activeSession = null
        reloading = false
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
        activeSession = null
        reloading = false
        active = false
        val ownedHost = host
        val ownedContext = context
        host = null
        context = null
        ownedHost?.invalidate()
        ownedContext?.event()
    }
}

/** Resolves Activity ownership on its own thread instead of treating queued work as acceptance. */
internal class RetainedRecoveryOwnerClaim(
    private val dispatch: (Runnable) -> Unit,
    private val timeoutMillis: Long = 5_000L,
) {
    fun await(claim: () -> Boolean): Boolean {
        val task = FutureTask(claim)
        return try {
            dispatch(task)
            task.get(timeoutMillis, TimeUnit.MILLISECONDS)
        } catch (_: Exception) {
            task.cancel(false)
            false
        }
    }
}

/** Requests a single Activity replacement after its host has been terminally invalidated. */
internal class KioskWebActivityRecreation {
    private var stopped = false
    private var recreationRequested = false

    @Synchronized
    fun onStop() {
        stopped = true
    }

    @Synchronized
    fun onResume(): Boolean {
        if (!stopped || recreationRequested) return false
        recreationRequested = true
        return true
    }

    @Synchronized
    fun onRetainedRecoveryReady(canRecreate: Boolean): Boolean {
        if (recreationRequested) return false
        recreationRequested = true
        return canRecreate
    }
}

/** Dedicated kiosk host for the exact terminal page and its native-only message bridge. */
class KioskWebActivity : Activity() {
    private var webView: WebView? = null
    private var lifecycle: KioskWebHostLifecycle? = null
    private val recreation = KioskWebActivityRecreation()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(KIOSK_WINDOW_FLAGS)
        val admission = SecureWebAdmission.from(BuildConfig.APPROVED_HTTPS_ORIGIN) ?: run { finish(); return }
        val app = application as? KioskApplication ?: run { finish(); return }
        val view = WebView(this)
        val readiness = app.createWebSessionReadiness(admission) {
            RetainedRecoveryOwnerClaim(::runOnUiThread).await {
                if (!recreation.onRetainedRecoveryReady(!isFinishing && !isDestroyed)) false
                else {
                    recreate()
                    true
                }
            }
        }
        lifecycle = KioskWebHostLifecycle(
            admission,
            readiness::capture,
            readiness::currentSession,
            {
                app.createPreparedBridgeContext(admission)?.let { prepared ->
                    object : KioskWebHostContext {
                        override val bridge = prepared.bridge
                        override val webEvents = prepared.events
                        override fun survivesDocumentReplacement() = !prepared.operations.hasPendingOperation()
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
                val host = SecureWebMessageHost(view, admission, BuildConfig.NATIVE_COLLECTION_ENABLED, context.bridge, context.webEvents)
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

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                lifecycle?.onPageStarted(url)
            }

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

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // Customers see only the terminal; an edge swipe reveals the bars briefly and they hide again.
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = LEGACY_IMMERSIVE_FLAGS
        }
    }

    override fun onResume() {
        super.onResume()
        if (recreation.onResume()) recreate()
    }

    override fun onDestroy() {
        releaseWebView(webView) { lifecycle?.onDestroy() }
        webView = null
        super.onDestroy()
    }

    companion object {
        // A self check-in kiosk never sleeps: screen-off stops the Activity, which releases the reader connection.
        const val KIOSK_WINDOW_FLAGS = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        @Suppress("DEPRECATION")
        const val LEGACY_IMMERSIVE_FLAGS = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        /** Invalidates the host first, then detaches the WebView as WebView.destroy() requires, then destroys it. */
        internal fun releaseWebView(view: WebView?, invalidateHost: () -> Unit) {
            invalidateHost()
            if (view == null) return
            (view.parent as? android.view.ViewGroup)?.removeView(view)
            view.destroy()
        }

        internal fun isExactTerminalCompletion(admission: SecureWebAdmission, completedUrl: String?, currentUrl: String?) =
            completedUrl == admission.terminalUrl && currentUrl == admission.terminalUrl
    }
}
