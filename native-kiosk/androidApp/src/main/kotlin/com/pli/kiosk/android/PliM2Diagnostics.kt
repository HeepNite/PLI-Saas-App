package com.pli.kiosk.android

/**
 * Temporary coarse M2 sale diagnostics. Callers must pass only fixed phrases, counts, or coarse
 * categories: never serials, reader ids, locations, tokens, client secrets, PaymentIntent ids, or
 * personal data.
 */
internal object PliM2Diagnostics {
    const val TAG = "PLI-M2"

    fun log(message: String) {
        try { android.util.Log.i(TAG, message) } catch (_: Exception) { Unit }
    }
}
