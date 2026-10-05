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
    private var messageHost: SecureWebMessageHost? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val admission = SecureWebAdmission.from(BuildConfig.APPROVED_HTTPS_ORIGIN) ?: run { finish(); return }
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
                    !request.isForMainFrame || !admission.allowsMainFrameNavigation(request.url.toString(), request.isRedirect)
            }
            view.webChromeClient = object : WebChromeClient() {
                override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message) = false
            }
            setContentView(view)
            messageHost = SecureWebMessageHost(view, admission, BuildConfig.NATIVE_COLLECTION_ENABLED, null)
            messageHost?.attach()
            view.loadUrl(admission.terminalUrl)
        }
    }

    override fun onDestroy() {
        messageHost?.invalidate()
        webView?.destroy()
        super.onDestroy()
    }
}
