type AndroidXBridge = {
  postMessage: (message: string) => unknown
  onmessage?: ((event: { data: unknown }) => void) | null
}

type NativeState = "accepted" | "pending" | "rejected" | "uncertain"
type ParsedResponse = { state: Exclude<NativeState, "uncertain"> }

const referencePattern = /^[A-Za-z0-9_-]{43}$/
const operationReferencePattern = /^[A-Za-z0-9_-]{1,128}$/
const nativeErrors = new Set(["REJECTED", "UNAVAILABLE", "SESSION_EXPIRED", "READER_UNAVAILABLE", "UNRESOLVED"])

function bridge(): AndroidXBridge | null {
  if (typeof window === "undefined") return null
  const candidate = (window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge
  return candidate && typeof candidate === "object" && typeof (candidate as AndroidXBridge).postMessage === "function"
    ? candidate as AndroidXBridge
    : null
}

function closedObject(value: unknown, keys: string[]) {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

export function isNativePaymentBridgeAvailable() {
  return bridge() !== null
}

export function isPreparedPurchaseResponse(value: unknown): value is { preparedPurchaseReference: string; state: "prepared" } {
  return closedObject(value, ["preparedPurchaseReference", "state"]) &&
    typeof (value as { preparedPurchaseReference: unknown }).preparedPurchaseReference === "string" &&
    referencePattern.test((value as { preparedPurchaseReference: string }).preparedPurchaseReference) &&
    (value as { state: unknown }).state === "prepared"
}

export function parsePreparedPurchaseResponse(value: unknown, requestId: string): ParsedResponse | null {
  if (!closedObject(value, ["version", "operation", "requestId", "payload"])) return null
  const response = value as { version: unknown; operation: unknown; requestId: unknown; payload: unknown }
  if (response.version !== 1 || response.operation !== "startPreparedPurchase" || response.requestId !== requestId || !response.payload || typeof response.payload !== "object") return null
  const payload = response.payload as { operationReference?: unknown; state?: unknown; error?: unknown }
  const state = payload.state
  const keys = state === "rejected" && typeof payload.error !== "undefined"
    ? ["operationReference", "state", "error"]
    : ["operationReference", "state"]
  if (!closedObject(payload, keys) || typeof payload.operationReference !== "string" || !operationReferencePattern.test(payload.operationReference) || !["accepted", "pending", "rejected"].includes(state as string)) return null
  if (typeof payload.error !== "undefined" && (typeof payload.error !== "string" || !nativeErrors.has(payload.error))) return null
  return { state: state as ParsedResponse["state"] }
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `native-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function handOffPreparedPurchase(preparedPurchaseReference: string, timeoutMs = 5_000): Promise<{ admitted: boolean; state: NativeState }> {
  const target = bridge()
  if (!target || !referencePattern.test(preparedPurchaseReference)) return { admitted: false, state: "uncertain" }
  const id = requestId()
  const message = JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: id, payload: { preparedPurchaseReference } })

  return new Promise((resolve) => {
    const previous = target.onmessage
    let settled = false
    let timer: ReturnType<typeof setTimeout>
    const finish = (state: NativeState) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { if (target.onmessage === onmessage) target.onmessage = previous } catch { /* native dispatch is already admitted */ }
      resolve({ admitted: true, state })
    }
    const onmessage = (event: { data: unknown }) => {
      try {
        const parsed = typeof event.data === "string" ? parsePreparedPurchaseResponse(JSON.parse(event.data), id) : null
        finish(parsed?.state ?? "uncertain")
      } catch { finish("uncertain") }
    }
    try { target.onmessage = onmessage } catch { /* postMessage remains an admitted attempt */ }
    timer = setTimeout(() => finish("uncertain"), timeoutMs)
    try { target.postMessage(message) } catch { finish("uncertain") }
  })
}
