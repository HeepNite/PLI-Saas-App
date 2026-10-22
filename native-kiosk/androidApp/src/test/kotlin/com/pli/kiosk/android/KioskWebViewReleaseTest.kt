package com.pli.kiosk.android

import android.widget.FrameLayout
import android.webkit.WebView
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import kotlin.test.assertEquals

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class KioskWebViewReleaseTest {
    @Test
    fun destroyInvalidatesTheHostThenDetachesTheWebViewBeforeDestroyingIt() {
        val order = mutableListOf<String>()
        val context = RuntimeEnvironment.getApplication()
        val parent = FrameLayout(context)
        val view = object : WebView(context) {
            override fun destroy() {
                order += "destroy:attached=${parent.indexOfChild(this) >= 0}"
                super.destroy()
            }
        }
        parent.addView(view)

        KioskWebActivity.releaseWebView(view) { order += "host.invalidate:attached=${parent.indexOfChild(view) >= 0}" }

        assertEquals(listOf("host.invalidate:attached=true", "destroy:attached=false"), order)
    }

    @Test
    fun destroyWithoutAWebViewStillInvalidatesTheHost() {
        val order = mutableListOf<String>()
        KioskWebActivity.releaseWebView(null) { order += "host.invalidate" }
        assertEquals(listOf("host.invalidate"), order)
    }
}
