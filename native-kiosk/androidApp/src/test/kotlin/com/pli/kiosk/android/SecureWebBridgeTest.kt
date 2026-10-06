package com.pli.kiosk.android

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SecureWebBridgeTest {
    @Test
    fun validDispatchValidatesFieldsAndReturnsOnlyCoarseData() {
        var received: Map<String, String>? = null
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(mapOf("token" to 12)) {
            received = it
            SecureBridgeState.ACCEPTED
        })) { _, _ -> "opaque-ref" }

        val response = bridge.dispatch(request("one", "collect", "{\"token\":\"abc\"}"))

        assertEquals(SecureBridgeResponse("one", "opaque-ref", SecureBridgeState.ACCEPTED), response)
        assertEquals(mapOf("token" to "abc"), received)
    }

    @Test
    fun rejectsOversizeMalformedAndExtraEnvelopeFields() {
        val bridge = bridge()
        val cases = listOf(
            "not-json",
            request("one", "collect", "{}", ",\"extra\":true"),
            request("one", "collect", "{}", "").replace("\"payload\":{}", "\"payload\":[]"),
            request("one", "collect", "{}", "").replace("\"operation\":\"collect\"", "\"operation\":\"\""),
            request("one", "collect", "{}", "").replace("\"requestId\":\"one\"", "\"requestId\":\"\""),
            request("one", "collect", "{}", "").replace("\"version\":1", "\"version\":\"1\""),
        )

        cases.forEach { assertEquals(SecureBridgeError.MALFORMED_REQUEST, bridge.dispatch(it).error) }
        listOf(16 * 1024 + 1, 16 * 1024 * 64).forEach { assertEquals(SecureBridgeError.REQUEST_TOO_LARGE, bridge.dispatch("x".repeat(it)).error) }
    }

    @Test
    fun rejectsDuplicateKeysAndTrailingCommasBeforeHandling() {
        var calls = 0
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(mapOf("token" to 10)) { calls++; SecureBridgeState.ACCEPTED }))
        val cases = listOf(
            "{\"version\":1,\"operation\":\"collect\",\"operation\":\"collect\",\"requestId\":\"envelope\",\"payload\":{\"token\":\"ok\"}}",
            "{\"version\":1,\"operation\":\"collect\",\"requestId\":\"payload\",\"payload\":{\"token\":\"ok\",\"token\":\"ok\"}}",
            request("trailing-envelope", "collect", "{\"token\":\"ok\"}", ","),
            request("trailing-payload", "collect", "{\"token\":\"ok\",}"),
            request("trailing-object", "collect", "{\"token\":\"ok\"}", ",\"extra\":{\"nested\":true,}"),
            request("unknown-deep", "collect", "{\"token\":\"ok\"}", ",\"extra\":" + "[".repeat(4_000) + "]".repeat(4_000)),
        )

        cases.forEach { assertEquals(SecureBridgeError.MALFORMED_REQUEST, bridge.dispatch(it).error) }
        assertEquals(0, calls)
    }

    @Test
    fun rejectsUnknownVersionAndOperationBeforeHandling() {
        var calls = 0
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(emptyMap()) { calls++; SecureBridgeState.ACCEPTED }))

        listOf("2", "1.0").forEach { version ->
            assertEquals(SecureBridgeError.UNSUPPORTED_VERSION, bridge.dispatch(request("version-$version", "collect", "{}").replace("\"version\":1", "\"version\":$version")).error)
        }
        assertEquals(SecureBridgeError.UNKNOWN_OPERATION, bridge.dispatch(request("two", "missing", "{}")).error)
        assertEquals(0, calls)
    }

    @Test
    fun rejectsClosedPayloadSchemaTypesAndLengthsBeforeHandling() {
        var calls = 0
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(mapOf("token" to 3)) { calls++; SecureBridgeState.ACCEPTED }))
        val deep = "[".repeat(4_000) + "]".repeat(4_000); assertEquals(SecureBridgeError.MALFORMED_REQUEST, bridge.dispatch(request("deep", "collect", "{\"token\":$deep}")).error)
        val payloads = listOf("{}", "{\"token\":\"ok\",\"extra\":\"x\"}", "{\"token\":1}", "{\"token\":\"long\"}")

        payloads.forEachIndexed { index, payload ->
            assertEquals(if (payload == "{\"token\":1}") SecureBridgeError.MALFORMED_REQUEST else SecureBridgeError.INVALID_PAYLOAD, bridge.dispatch(request("payload-$index", "collect", payload)).error)
        }
        assertEquals(0, calls)
    }

    @Test fun closesResponseCacheAfterCapacityWhileServingDuplicates() {
        var calls = 0
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(emptyMap()) { calls++; SecureBridgeState.ACCEPTED }))
        repeat(256) { bridge.dispatch(request("id-$it", "collect", "{}")) }
        assertEquals(SecureBridgeState.ACCEPTED, bridge.dispatch(request("id-0", "collect", "{}")).state)
        listOf("overflow", "later").forEach { assertEquals(SecureBridgeError.RESPONSE_CACHE_EXHAUSTED, bridge.dispatch(request(it, "collect", "{}")).error) }
        assertEquals(256, calls)
    }

    @Test
    fun duplicateIdIsCachedAndDifferentBytesConflictWithoutAnotherCall() {
        var calls = 0
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(mapOf("token" to 10)) { calls++; SecureBridgeState.PENDING })) { _, _ -> "ref-$calls" }
        val request = request("same", "collect", "{\"token\":\"a\"}")

        val first = bridge.dispatch(request)
        val second = bridge.dispatch(request)
        val conflict = bridge.dispatch(request("same", "collect", "{\"token\":\"b\"}"))

        assertEquals(first, second)
        assertEquals("ref-0", first.operationRef)
        assertEquals(SecureBridgeError.REQUEST_ID_CONFLICT, conflict.error)
        assertEquals(1, calls)
        assertCachedRequestDigest(bridge)
    }

    @Test
    fun requestBoundHandlersReceiveTheValidatedRequestAndGeneratedReferenceBeforeSideEffects() {
        var received: Triple<String, String, Map<String, String>>? = null
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(mapOf("token" to 10)) { requestId, reference, fields ->
            received = Triple(requestId, reference, fields)
            SecureBridgeState.PENDING
        })) { requestId, operation -> "opaque-$requestId-$operation" }

        val response = bridge.dispatch(request("one", "collect", "{\"token\":\"abc\"}"))

        assertEquals("opaque-one-collect", response.operationRef)
        assertEquals(Triple("one", "opaque-one-collect", mapOf("token" to "abc")), received)
    }

    @Test
    fun handlerFailuresAreRedactedAndCached() {
        var calls = 0
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(emptyMap()) { calls++; error("provider detail") }))
        val request = request("one", "collect", "{}")

        val first = bridge.dispatch(request)
        assertEquals(SecureBridgeResponse("one", error = SecureBridgeError.INTERNAL_ERROR), first)
        assertEquals(first, bridge.dispatch(request))
        assertNull(first.operationRef)
        assertEquals(1, calls)
    }

    @Test
    fun invalidationClearsReferencesAndClosesTheContext() {
        val bridge = bridge(mapOf("collect" to SecureBridgeOperation(emptyMap()) { SecureBridgeState.ACCEPTED }))
        assertEquals(SecureBridgeState.ACCEPTED, bridge.dispatch(request("one", "collect", "{}")).state)

        bridge.invalidate()

        val response = bridge.dispatch(request("one", "collect", "{}"))
        assertEquals(SecureBridgeError.STALE_CONTEXT, response.error)
        assertNull(response.requestId)
        assertTrue(response.operationRef == null && response.state == null)
    }

    private fun assertCachedRequestDigest(bridge: SecureWebBridge) {
        val responses = bridge.javaClass.getDeclaredField("responses").apply { isAccessible = true }.get(bridge) as Map<*, *>
        val cached = responses.values.single() ?: error("missing cached response")
        val fields = cached.javaClass.declaredFields
        assertTrue(fields.none { it.name == "bytes" })
        val digest = fields.single { it.name == "digest" }.apply { isAccessible = true }.get(cached) as ByteArray
        assertEquals(32, digest.size)
    }

    private fun bridge(
        registry: Map<String, SecureBridgeOperation> = emptyMap(),
        reference: (String, String) -> String = { _, _ -> "opaque" },
    ) = SecureWebBridge(registry, reference)

    private fun request(id: String, operation: String, payload: String, suffix: String = "") =
        "{\"version\":1,\"operation\":\"$operation\",\"requestId\":\"$id\",\"payload\":$payload$suffix}"
}
