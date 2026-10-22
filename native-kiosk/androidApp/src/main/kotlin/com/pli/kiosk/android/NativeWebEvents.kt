package com.pli.kiosk.android

/** Delivers one serialized event to the admitted page; the host owns its thread and validity. */
fun interface NativeWebEventTarget { fun post(message: String) }

/** Customer-facing collection moments. They carry no payment, reader, or card data. */
enum class CollectionPrompt(val wire: String) { NONE("none"), AWAITING_CARD("awaiting_card"), PROCESSING("processing") }

/**
 * Native-to-page push channel for one admitted bridge context. It emits only two closed event
 * shapes, coarse reader status and collection prompt, and never identifiers, serials, or secrets.
 * The page target is the reply proxy of the latest admitted message, so nothing is pushed until the
 * page itself has spoken through the origin-locked bridge.
 */
class NativeWebEvents {
    private var target: NativeWebEventTarget? = null
    private var status: ReaderStatus? = null
    private var prompt = CollectionPrompt.NONE
    private var statusRequested = false
    private var invalidated = false

    @Synchronized fun bind(target: NativeWebEventTarget) {
        if (invalidated) return
        this.target = target
        if (statusRequested) {
            statusRequested = false
            status?.let { post(statusMessage(it)) }
        }
    }

    /** Answers a page `getReaderStatus` request at the next bind with the current status. */
    @Synchronized fun requestStatus() {
        if (!invalidated) statusRequested = true
    }

    @Synchronized fun readerStatus(next: ReaderStatus) {
        if (invalidated || next == status) return
        status = next
        post(statusMessage(next))
    }

    @Synchronized fun collectionPrompt(next: CollectionPrompt) {
        if (invalidated || next == prompt) return
        prompt = next
        post("{\"version\":1,\"event\":\"collectionPrompt\",\"payload\":{\"prompt\":\"${next.wire}\"}}")
    }

    @Synchronized fun invalidate() {
        invalidated = true
        target = null
    }

    private fun post(message: String) {
        try { target?.post(message) } catch (_: Exception) { Unit }
    }

    private fun statusMessage(value: ReaderStatus) =
        "{\"version\":1,\"event\":\"readerStatus\",\"payload\":{\"status\":\"${value.name.lowercase()}\"}}"

    companion object {
        const val READ_STATUS = "getReaderStatus"
    }
}
