package com.pli.kiosk.android

import java.security.MessageDigest

/** The only states a Web caller may learn about a validated native operation. */
enum class SecureBridgeState { ACCEPTED, PENDING, PAID, REJECTED }

/** Closed failures deliberately omit parser, handler, and platform details. */
enum class SecureBridgeError {
    REQUEST_TOO_LARGE,
    MALFORMED_REQUEST,
    UNSUPPORTED_VERSION,
    UNKNOWN_OPERATION,
    INVALID_PAYLOAD,
    REQUEST_ID_CONFLICT,
    INTERNAL_ERROR,
    STALE_CONTEXT,
}

/** A bridge reply has no diagnostic text or native/provider object surface. */
data class SecureBridgeResponse(
    val requestId: String?,
    val operationRef: String? = null,
    val state: SecureBridgeState? = null,
    val error: SecureBridgeError? = null,
    val operation: String? = null,
)

internal data class SecureBridgeOperationResult(val operationRef: String?, val state: SecureBridgeState)

/** An allowlisted operation with its complete string-only payload schema. */
class SecureBridgeOperation private constructor(
    val payload: Map<String, Int>,
    private val handler: (String, String, Map<String, String>) -> SecureBridgeOperationResult,
    @Suppress("UNUSED_PARAMETER") responseAware: Unit,
) {
    constructor(payload: Map<String, Int>, handler: (String, String, Map<String, String>) -> SecureBridgeState) :
        this(payload, { requestId, reference, fields -> SecureBridgeOperationResult(reference, handler(requestId, reference, fields)) }, Unit)

    /** Compatibility constructor for existing payload-only handlers. */
    constructor(payload: Map<String, Int>, handler: (Map<String, String>) -> SecureBridgeState) :
        this(payload, { _, _, fields -> handler(fields) })

    /** Supplies the validated request ID without exposing the raw envelope. */
    constructor(payload: Map<String, Int>, handler: (String, Map<String, String>) -> SecureBridgeState) :
        this(payload, { requestId, _, fields -> handler(requestId, fields) })

    internal fun handle(requestId: String, operationRef: String, fields: Map<String, String>) = handler(requestId, operationRef, fields)

    companion object {
        internal fun withResponse(payload: Map<String, Int>, handler: (String, String, Map<String, String>) -> SecureBridgeOperationResult) =
            SecureBridgeOperation(payload, handler, Unit)
    }
}

/**
 * Framework-neutral request parser and serialized dispatcher for one reader/session/origin context.
 * Construct a fresh instance for a replacement context; [invalidate] permanently closes this one.
 */
class SecureWebBridge(
    registry: Map<String, SecureBridgeOperation>,
    private val operationRefFactory: (requestId: String, operation: String) -> String,
) {
    private val registry = registry.toMap()
    /**
     * Bounded replay cache in insertion order. When full, the oldest entry is evicted instead of
     * refusing new requests: the web polls every 500 ms during a sale, so a hard cap starved the
     * bridge after ~2 minutes of cumulative sale time and the web saw no reply while the native
     * sale kept collecting. Eviction is safe because every operation is idempotent or server-bound
     * (polls are read-only; startPreparedPurchase is bound to a single-use server prepared
     * reference plus the native single-attempt guard), so re-dispatching an evicted, long-past
     * requestId cannot double charge. Recent requestIds keep exact-replay and conflict semantics.
     */
    private val responses = LinkedHashMap<String, CachedResponse>()
    private var invalidated = false
    init {
        require(this.registry.keys.all { bounded(it, MAX_OPERATION_CHARS) })
        require(this.registry.values.all { operation ->
            operation.payload.all { (name, maxLength) ->
                bounded(name, MAX_FIELD_NAME_CHARS) && maxLength in 1..MAX_REQUEST_BYTES
            }
        })
    }

    @Synchronized
    fun dispatch(raw: String): SecureBridgeResponse {
        if (invalidated) return failure(null, SecureBridgeError.STALE_CONTEXT)
        if (raw.length > MAX_REQUEST_BYTES) return failure(null, SecureBridgeError.REQUEST_TOO_LARGE)
        val bytes = raw.toByteArray(Charsets.UTF_8)
        if (bytes.size > MAX_REQUEST_BYTES) return failure(null, SecureBridgeError.REQUEST_TOO_LARGE)
        val envelope = parse(raw) ?: return failure(null, SecureBridgeError.MALFORMED_REQUEST)
        val requestDigest = MessageDigest.getInstance("SHA-256").digest(bytes)
        responses[envelope.requestId]?.let { cached ->
            return if (MessageDigest.isEqual(cached.digest, requestDigest)) cached.response
            else failure(envelope.requestId, SecureBridgeError.REQUEST_ID_CONFLICT, envelope.operation)
        }
        val response = when {
            envelope.version != VERSION.toString() -> failure(envelope.requestId, SecureBridgeError.UNSUPPORTED_VERSION, envelope.operation)
            else -> dispatch(envelope)
        }
        while (responses.size >= MAX_CACHED_RESPONSES) responses.remove(responses.keys.first())
        responses[envelope.requestId] = CachedResponse(requestDigest, response)
        return response
    }

    @Synchronized
    fun invalidate() {
        invalidated = true
        responses.clear()
    }

    private fun dispatch(envelope: Envelope): SecureBridgeResponse {
        val operation = registry[envelope.operation]
            ?: return failure(envelope.requestId, SecureBridgeError.UNKNOWN_OPERATION, envelope.operation)
        val fields = fields(envelope.payload, operation.payload)
            ?: return failure(envelope.requestId, SecureBridgeError.INVALID_PAYLOAD, envelope.operation)
        return try {
            val reference = operationRefFactory(envelope.requestId, envelope.operation)
            if (!bounded(reference, MAX_OPERATION_REF_CHARS)) throw IllegalStateException()
            val result = operation.handle(envelope.requestId, reference, fields)
            SecureBridgeResponse(envelope.requestId, result.operationRef, result.state, operation = envelope.operation)
        } catch (_: Exception) {
            failure(envelope.requestId, SecureBridgeError.INTERNAL_ERROR, envelope.operation)
        }
    }

    private fun parse(raw: String): Envelope? = StrictJson(raw).envelope()?.takeIf {
        bounded(it.operation, MAX_OPERATION_CHARS) && bounded(it.requestId, MAX_REQUEST_ID_CHARS)
    }

    private fun fields(payload: Map<String, String?>, schema: Map<String, Int>): Map<String, String>? {
        if (payload.keys != schema.keys) return null
        return buildMap {
            schema.forEach { (name, maxLength) ->
                val value = payload[name] ?: return null
                if (!bounded(value, maxLength)) return null
                put(name, value)
            }
        }
    }

    private fun failure(requestId: String?, error: SecureBridgeError, operation: String? = null) =
        SecureBridgeResponse(requestId, error = error, operation = operation)

    private data class Envelope(val version: String, val operation: String, val requestId: String, val payload: Map<String, String?>)
    /** Retains only a fixed SHA-256 digest, never raw request/capability bytes. */
    private data class CachedResponse(val digest: ByteArray, val response: SecureBridgeResponse)

    /** Parses JSON without collapsing duplicate envelope or payload keys. */
    private class StrictJson(private val source: String) {
        private var index = 0
        fun envelope(): Envelope? {
            whitespace()
            if (!consume('{')) return null
            val keys = mutableSetOf<String>()
            var version: String? = null
            var operation: String? = null
            var requestId: String? = null
            var payload: Map<String, String?>? = null
            whitespace()
            while (!consume('}')) {
                val key = string() ?: return null
                if (!keys.add(key) || !consumeAfterKey()) return null
                when (key) {
                    "version" -> version = number()
                    "operation" -> operation = string()
                    "requestId" -> requestId = string()
                    "payload" -> payload = payload()
                    else -> return null
                }
                if ((key == "version" && version == null) || (key == "operation" && operation == null) ||
                    (key == "requestId" && requestId == null) || (key == "payload" && payload == null)) return null
                whitespace()
                if (consume('}')) break
                if (!consume(',')) return null
                whitespace()
                if (source.getOrNull(index) == '}') return null
            }
            whitespace()
            return if (index == source.length && keys == ENVELOPE_KEYS && version != null && operation != null && requestId != null && payload != null)
                Envelope(version, operation, requestId, payload) else null
        }

        private fun payload(): Map<String, String?>? {
            if (!consume('{')) return null
            val fields = mutableMapOf<String, String?>()
            whitespace()
            while (!consume('}')) {
                val key = string() ?: return null
                if (fields.containsKey(key) || !consumeAfterKey()) return null
                fields[key] = string() ?: return null
                whitespace()
                if (consume('}')) break
                if (!consume(',')) return null
                whitespace()
                if (source.getOrNull(index) == '}') return null
            }
            return fields
        }

        private fun consumeAfterKey(): Boolean {
            whitespace()
            if (!consume(':')) return false
            whitespace()
            return true
        }

        private fun string(): String? {
            if (!consume('"')) return null
            val value = StringBuilder()
            while (index < source.length) when (val character = source[index++]) {
                '"' -> return value.toString()
                '\\' -> when (val escaped = source.getOrNull(index++) ?: return null) {
                    '"', '\\', '/' -> value.append(escaped)
                    'b' -> value.append('\b')
                    'f' -> value.append('\u000C')
                    'n' -> value.append('\n')
                    'r' -> value.append('\r')
                    't' -> value.append('\t')
                    'u' -> {
                        val hex = source.substring(index, (index + 4).coerceAtMost(source.length))
                        if (hex.length != 4 || hex.any { !it.isDigit() && it.lowercaseChar() !in 'a'..'f' }) return null
                        value.append(hex.toInt(16).toChar()); index += 4
                    }
                    else -> return null
                }
                else -> if (character < ' ') return null else value.append(character)
            }
            return null
        }

        private fun number(): String? {
            val start = index
            consume('-')
            when (source.getOrNull(index)) {
                '0' -> index++
                in '1'..'9' -> while (source.getOrNull(index) in '0'..'9') index++
                else -> return null
            }
            if (consume('.')) {
                if (source.getOrNull(index) !in '0'..'9') return null
                while (source.getOrNull(index) in '0'..'9') index++
            }
            if (source.getOrNull(index) in listOf('e', 'E')) {
                index++; if (source.getOrNull(index) in listOf('+', '-')) index++
                if (source.getOrNull(index) !in '0'..'9') return null
                while (source.getOrNull(index) in '0'..'9') index++
            }
            return source.substring(start, index)
        }

        private fun literal(expected: String) = source.regionMatches(index, expected, 0, expected.length).also { if (it) index += expected.length }
        private fun consume(character: Char) = (source.getOrNull(index) == character).also { if (it) index++ }
        private fun whitespace() { while (source.getOrNull(index)?.let { it in " \t\n\r" } == true) index++ }
    }

    private companion object {
        const val VERSION = 1
        const val MAX_CACHED_RESPONSES = 256
        const val MAX_REQUEST_BYTES = 16 * 1024
        const val MAX_OPERATION_CHARS = 64
        const val MAX_REQUEST_ID_CHARS = 128
        const val MAX_FIELD_NAME_CHARS = 64
        const val MAX_OPERATION_REF_CHARS = 128
        val ENVELOPE_KEYS = setOf("version", "operation", "requestId", "payload")

        fun bounded(value: String, maxLength: Int) = value.isNotBlank() && value.length <= maxLength
    }
}
