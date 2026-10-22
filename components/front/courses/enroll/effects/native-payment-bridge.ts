type AndroidXBridge = {
  postMessage: (message: string) => unknown
  onmessage?: ((event: { data: unknown }) => void) | null
}

type NativeState = "accepted" | "pending" | "rejected" | "uncertain"
type BridgeState = Exclude<NativeState, "uncertain"> | "paid"
type ParsedResponse = { operationReference: string; state: BridgeState }

const referencePattern = /^[A-Za-z0-9_-]{43}$/
const operationReferencePattern = /^[A-Za-z0-9_-]{1,128}$/
const nativeErrors = new Set(["REJECTED", "UNAVAILABLE", "SESSION_EXPIRED", "READER_UNAVAILABLE", "UNRESOLVED"])
const diagnosticTimeoutMs = 2_000
const diagnosticGlobalName = "pliNativeBridgeDiagnostic"
const nativeBridgeRecoveryKey = "pli-native-bridge-recovery.v1"

type NativeDiagnosticResult = { success: boolean }
type NativeDiagnosticCallable = () => Promise<NativeDiagnosticResult>

const ownedDiagnosticCallables = new WeakSet<NativeDiagnosticCallable>()

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

export function isNativeKioskWebView(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /\bAndroid\b/i.test(userAgent) && /(?:;\s*wv\)|\bwv\b)/i.test(userAgent)
}

export function hasNativeKioskBridgeRecoveryAttempted() {
  if (typeof window === "undefined") return false
  try { return window.sessionStorage.getItem(nativeBridgeRecoveryKey) === "attempted" }
  catch { return true }
}

export function recoverNativeKioskBridge(
  reload: () => void = () => window.location.reload()
): "ready" | "reloading" | "unavailable" | "not_native_webview" {
  if (typeof window === "undefined" || !isNativeKioskWebView()) return "not_native_webview"
  if (bridge()) {
    try { window.sessionStorage.removeItem(nativeBridgeRecoveryKey) } catch { /* readiness does not depend on storage */ }
    return "ready"
  }
  try {
    if (window.sessionStorage.getItem(nativeBridgeRecoveryKey) === "attempted") return "unavailable"
    window.sessionStorage.setItem(nativeBridgeRecoveryKey, "attempted")
  } catch {
    return "unavailable"
  }
  try { reload() } catch { /* remain fail-closed while the current document is still active */ }
  return "reloading"
}

export function isPreparedPurchaseResponse(value: unknown): value is { preparedPurchaseReference: string; state: "prepared" } {
  return closedObject(value, ["preparedPurchaseReference", "state"]) &&
    typeof (value as { preparedPurchaseReference: unknown }).preparedPurchaseReference === "string" &&
    referencePattern.test((value as { preparedPurchaseReference: string }).preparedPurchaseReference) &&
    (value as { state: unknown }).state === "prepared"
}

function parseBridgeResponse(value: unknown, requestId: string, operation: string, states: BridgeState[]): ParsedResponse | null {
  if (!closedObject(value, ["version", "operation", "requestId", "payload"])) return null
  const response = value as { version: unknown; operation: unknown; requestId: unknown; payload: unknown }
  if (response.version !== 1 || response.operation !== operation || response.requestId !== requestId || !response.payload || typeof response.payload !== "object") return null
  const payload = response.payload as { operationReference?: unknown; state?: unknown; error?: unknown }
  const state = payload.state
  const keys = state === "rejected" && typeof payload.error !== "undefined"
    ? ["operationReference", "state", "error"]
    : ["operationReference", "state"]
  if (!closedObject(payload, keys) || typeof payload.operationReference !== "string" || !operationReferencePattern.test(payload.operationReference) || !states.includes(state as BridgeState)) return null
  if (typeof payload.error !== "undefined" && (typeof payload.error !== "string" || !nativeErrors.has(payload.error))) return null
  return { operationReference: payload.operationReference, state: state as BridgeState }
}

export function parsePreparedPurchaseResponse(value: unknown, requestId: string): { state: NativeState } | null {
  const parsed = parseBridgeResponse(value, requestId, "startPreparedPurchase", ["accepted", "pending", "rejected"])
  return parsed ? { state: parsed.state as NativeState } : null
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `native-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isDiagnosticResponse(value: unknown, id: string) {
  if (!closedObject(value, ["version", "operation", "requestId", "payload"])) return false
  const response = value as { version: unknown; operation: unknown; requestId: unknown; payload: unknown }
  if (response.version !== 1 || response.operation !== "diagnosticRoundTrip" || response.requestId !== id) return false
  const payload = response.payload as { operationReference?: unknown; state?: unknown }
  return closedObject(payload, ["operationReference", "state"]) &&
    typeof payload.operationReference === "string" && operationReferencePattern.test(payload.operationReference) && payload.state === "accepted"
}

const diagnosticRoundTrip: NativeDiagnosticCallable = () => {
  const target = bridge()
  if (!target) return Promise.resolve({ success: false })
  const id = requestId()
  const message = JSON.stringify({ version: 1, operation: "diagnosticRoundTrip", requestId: id, payload: {} })
  return new Promise((resolve) => {
    const previous = target.onmessage
    let settled = false
    const finish = (success: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { if (target.onmessage === onmessage) target.onmessage = previous } catch { /* a diagnostic has no recovery path */ }
      resolve({ success })
    }
    const onmessage = (event: { data: unknown }) => {
      try { finish(typeof event.data === "string" && isDiagnosticResponse(JSON.parse(event.data), id)) }
      catch { finish(false) }
    }
    try { target.onmessage = onmessage } catch { /* postMessage may still be usable */ }
    const timer = setTimeout(() => finish(false), diagnosticTimeoutMs)
    try { target.postMessage(message) } catch { finish(false) }
  })
}

/** Installs the input-free, coarse-result CDP diagnostic only in browser documents. */
export function installPliNativeBridgeDiagnostic() {
  if (typeof window === "undefined" || typeof document === "undefined") return false
  const descriptor = Object.getOwnPropertyDescriptor(window, diagnosticGlobalName)
  if (descriptor) return typeof descriptor.value === "function" && ownedDiagnosticCallables.has(descriptor.value as NativeDiagnosticCallable)
  if (diagnosticGlobalName in window) return false
  ownedDiagnosticCallables.add(diagnosticRoundTrip)
  Object.defineProperty(window, diagnosticGlobalName, { value: diagnosticRoundTrip, writable: false, configurable: true })
  return true
}

installPliNativeBridgeDiagnostic()

export async function handOffPreparedPurchase(preparedPurchaseReference: string, timeoutMs = 5_000): Promise<{ admitted: boolean; state: NativeState; operationReference?: string }> {
  const target = bridge()
  if (!target || !referencePattern.test(preparedPurchaseReference)) return { admitted: false, state: "uncertain" }
  const id = requestId()
  const message = JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: id, payload: { preparedPurchaseReference } })

  return new Promise((resolve) => {
    const previous = target.onmessage
    let settled = false
    const finish = (state: NativeState, operationReference?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { if (target.onmessage === onmessage) target.onmessage = previous } catch { /* native dispatch is already admitted */ }
      resolve({ admitted: true, state, ...(operationReference ? { operationReference } : {}) })
    }
    const onmessage = (event: { data: unknown }) => {
      try {
        const parsed = typeof event.data === "string"
          ? parseBridgeResponse(JSON.parse(event.data), id, "startPreparedPurchase", ["accepted", "pending", "rejected"])
          : null
        finish((parsed?.state as NativeState | undefined) ?? "uncertain", parsed?.operationReference)
      } catch { finish("uncertain") }
    }
    try { target.onmessage = onmessage } catch { /* postMessage remains an admitted attempt */ }
    const timer = setTimeout(() => finish("uncertain"), timeoutMs)
    try { target.postMessage(message) } catch { finish("uncertain") }
  })
}

/** Reads one coarse state for the exact operation already admitted by native. */
export async function pollPreparedPurchaseState(operationReference: string, timeoutMs = 5_000): Promise<"pending" | "paid" | "rejected" | "uncertain"> {
  const target = bridge()
  if (!target || !operationReferencePattern.test(operationReference)) return "uncertain"
  const id = requestId()
  const message = JSON.stringify({ version: 1, operation: "getPreparedPurchaseState", requestId: id, payload: { operationReference } })

  return new Promise((resolve) => {
    const previous = target.onmessage
    let settled = false
    const finish = (state: "pending" | "paid" | "rejected" | "uncertain") => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { if (target.onmessage === onmessage) target.onmessage = previous } catch { /* an admitted operation remains native-owned */ }
      resolve(state)
    }
    const onmessage = (event: { data: unknown }) => {
      try {
        const parsed = typeof event.data === "string"
          ? parseBridgeResponse(JSON.parse(event.data), id, "getPreparedPurchaseState", ["pending", "paid", "rejected"])
          : null
        finish(parsed?.operationReference === operationReference ? parsed.state as "pending" | "paid" | "rejected" : "uncertain")
      } catch { finish("uncertain") }
    }
    try { target.onmessage = onmessage } catch { /* postMessage remains usable in some WebView implementations */ }
    const timer = setTimeout(() => finish("uncertain"), timeoutMs)
    try { target.postMessage(message) } catch { finish("uncertain") }
  })
}
