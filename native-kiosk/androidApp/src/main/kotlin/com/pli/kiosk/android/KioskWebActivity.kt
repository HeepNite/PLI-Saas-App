package com.pli.kiosk.android

import android.app.Activity
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/** Dedicated kiosk host; native collection composition remains deliberately absent in this slice. */
class KioskWebActivity : Activity() {
    private var webView: WebView? = null
    private var sessionReadiness: WebSessionReadiness? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val admission = SecureWebAdmission.from(BuildConfig.APPROVED_HTTPS_ORIGIN) ?: run { finish(); return }
        sessionReadiness = (application as? KioskApplication)?.createWebSessionReadiness(admission) ?: run { finish(); return }
        webView = WebView(this).also { view ->
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
                    admission.shouldOverrideNavigation(request.url.toString(), request.isRedirect, request.isForMainFrame)

                override fun onPageFinished(view: WebView, url: String?) {
                    if (isExactTerminalCompletion(admission, url, view.url)) sessionReadiness?.capture(url, view.url)
                }
            }
            view.webChromeClient = object : WebChromeClient() {
                override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message) = false
            }
            setContentView(view)
            // No dispatcher is composed in this slice, so no message listener or bridge is exposed.
            view.loadUrl(admission.terminalUrl)
        }
    }

    override fun onDestroy() {
        webView?.destroy()
        super.onDestroy()
    }

    companion object {
        internal fun isExactTerminalCompletion(admission: SecureWebAdmission, completedUrl: String?, currentUrl: String?) =
            completedUrl == admission.terminalUrl && currentUrl == admission.terminalUrl
    }
}
