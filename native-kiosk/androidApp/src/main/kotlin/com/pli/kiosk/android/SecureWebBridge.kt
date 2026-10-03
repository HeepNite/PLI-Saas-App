package com.pli.kiosk.android

/** The only states a Web caller may learn about a validated native operation. */
enum class SecureBridgeState { ACCEPTED, PENDING, REJECTED }

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
)

/** A registry entry is an allowlisted operation with its complete string-only payload schema. */
data class SecureBridgeOperation(
    val payload: Map<String, Int>,
    val handler: (Map<String, String>) -> SecureBridgeState,
)

/**
 * Framework-neutral request parser and serialized dispatcher for one reader/session/origin context.
 * Construct a fresh instance for a replacement context; [invalidate] permanently closes this one.
 */
class SecureWebBridge(
    registry: Map<String, SecureBridgeOperation>,
    private val operationRefFactory: (requestId: String, operation: String) -> String,
) {
    private val registry = registry.toMap()
    private val responses = mutableMapOf<String, CachedResponse>()
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
        val bytes = raw.toByteArray(Charsets.UTF_8)
        if (bytes.size > MAX_REQUEST_BYTES) return failure(null, SecureBridgeError.REQUEST_TOO_LARGE)
        val envelope = parse(raw) ?: return failure(null, SecureBridgeError.MALFORMED_REQUEST)
        responses[envelope.requestId]?.let { cached ->
            return if (cached.bytes.contentEquals(bytes)) cached.response
            else failure(envelope.requestId, SecureBridgeError.REQUEST_ID_CONFLICT)
        }
        val response = when {
            envelope.version != VERSION.toString() -> failure(envelope.requestId, SecureBridgeError.UNSUPPORTED_VERSION)
            else -> dispatch(envelope)
        }
        responses[envelope.requestId] = CachedResponse(bytes, response)
        return response
    }

    @Synchronized
    fun invalidate() {
        invalidated = true
        responses.clear()
    }

    private fun dispatch(envelope: Envelope): SecureBridgeResponse {
        val operation = registry[envelope.operation]
            ?: return failure(envelope.requestId, SecureBridgeError.UNKNOWN_OPERATION)
        val fields = fields(envelope.payload, operation.payload)
            ?: return failure(envelope.requestId, SecureBridgeError.INVALID_PAYLOAD)
        return try {
            val state = operation.handler(fields)
            val reference = operationRefFactory(envelope.requestId, envelope.operation)
            if (!bounded(reference, MAX_OPERATION_REF_CHARS)) throw IllegalStateException()
            SecureBridgeResponse(envelope.requestId, reference, state)
        } catch (_: Exception) {
            failure(envelope.requestId, SecureBridgeError.INTERNAL_ERROR)
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

    private fun failure(requestId: String?, error: SecureBridgeError) = SecureBridgeResponse(requestId, error = error)

    private data class Envelope(val version: String, val operation: String, val requestId: String, val payload: Map<String, String?>)
    private data class CachedResponse(val bytes: ByteArray, val response: SecureBridgeResponse)

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
                    else -> if (!value()) return null
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
                val value = if (source.getOrNull(index) == '"') string() else if (value()) null else return null
                fields[key] = value
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

        private fun value(): Boolean = when (source.getOrNull(index)) {
            '"' -> string() != null
            '{' -> objectValue()
            '[' -> array()
            't' -> literal("true")
            'f' -> literal("false")
            'n' -> literal("null")
            '-', in '0'..'9' -> number() != null
            else -> false
        }

        private fun objectValue(): Boolean {
            if (!consume('{')) return false
            whitespace()
            while (!consume('}')) {
                if (string() == null || !consumeAfterKey() || !value()) return false
                whitespace()
                if (consume('}')) break
                if (!consume(',')) return false
                whitespace()
                if (source.getOrNull(index) == '}') return false
            }
            return true
        }

        private fun array(): Boolean {
            if (!consume('[')) return false
            whitespace()
            while (!consume(']')) {
                if (!value()) return false
                whitespace()
                if (consume(']')) break
                if (!consume(',')) return false
                whitespace()
                if (source.getOrNull(index) == ']') return false
            }
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
        const val MAX_REQUEST_BYTES = 16 * 1024
        const val MAX_OPERATION_CHARS = 64
        const val MAX_REQUEST_ID_CHARS = 128
        const val MAX_FIELD_NAME_CHARS = 64
        const val MAX_OPERATION_REF_CHARS = 128
        val ENVELOPE_KEYS = setOf("version", "operation", "requestId", "payload")

        fun bounded(value: String, maxLength: Int) = value.isNotBlank() && value.length <= maxLength
    }
}
