import { act } from "react"
import { vi } from "vitest"
import type { TerminalChargeView } from "@/lib/terminal-charges/contract"

export const PREPARED_REFERENCE = "a".repeat(43)
export const PENDING_URL = "/api/staff/terminal/charges/pending"

export const makeCharge = (overrides: Partial<TerminalChargeView> = {}): TerminalChargeView => ({
  id: "charge_1", terminalId: "terminal-1", terminalName: "Front Desk", payerUserId: "user_1", payerName: "Ana Payer",
  status: "pending", totalCents: 8_000, currency: "usd", expiresAt: "2026-11-03T12:10:00.000Z", createdAt: "2026-11-03T12:00:00.000Z",
  resolvedAt: null, failureReason: null,
  items: [
    { id: "item_1", kind: "outstanding", label: "Outstanding — Salsa", amountCents: 2_000 },
    { id: "item_2", kind: "free_amount", label: "Extra classes", amountCents: 6_000 },
  ],
  ...overrides,
})

/** Routes fetch by URL; tests mutate `state.pending` to simulate the server between polls. */
export function installFetch(options: { pending?: TerminalChargeView | null } = {}) {
  const state = { pending: options.pending ?? null, resultConflict: null as string | null, calls: [] as Array<{ url: string; method: string; body: unknown }> }
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    state.calls.push({ url, method: init?.method ?? "GET", body })
    const reply = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data })
    if (url.startsWith("/api/checkin/terminal/today-classes")) return reply({ date: "2026-11-03", classes: [] })
    if (url === PENDING_URL) return reply({ charge: state.pending && { ...state.pending } }) // a fresh object per read, like JSON
    if (url.endsWith("/prepare")) return reply({ preparedPurchaseReference: PREPARED_REFERENCE, state: "prepared" })
    if (url.endsWith("/result")) {
      if (state.resultConflict) return reply({ error: state.resultConflict }, 409)
      state.pending = null
      return reply({ charge: makeCharge({ status: body.outcome }) })
    }
    return reply({}, 404)
  }))
  return { state, callsTo: (suffix: string) => state.calls.filter((call) => call.url.endsWith(suffix)) }
}

/** Fake native bridge: `startState` answers the hand-off; `pollStates` answer successive state reads. */
export function installBridge(options: { startState?: "accepted" | "rejected"; pollStates?: Array<"pending" | "paid" | "rejected"> } = {}) {
  const pollStates = [...(options.pollStates ?? ["paid"])]
  const requests: Array<{ operation: string; payload: unknown }> = []
  const bridge = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    postMessage: vi.fn((raw: string) => {
      const request = JSON.parse(raw) as { operation: string; requestId: string; payload: unknown }
      requests.push(request)
      const state = request.operation === "startPreparedPurchase" ? options.startState ?? "accepted"
        : request.operation === "getPreparedPurchaseState" ? (pollStates.length > 1 ? pollStates.shift() : pollStates[0]) : null
      if (!state) return
      const payload = { operationReference: "op_1", state }
      setTimeout(() => bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: request.operation, requestId: request.requestId, payload }) }), 0)
    }),
  }
  ;(window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge = bridge
  return { requests, readerPolls: () => requests.filter((request) => request.operation === "getPreparedPurchaseState").length }
}

export const removeBridge = () => delete (window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge

export const advance = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms)
})

export function setVisibility(next: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => next })
  document.dispatchEvent(new Event("visibilitychange"))
}
