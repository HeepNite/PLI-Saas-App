// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildQuickRepeatCardPayload,
  resolveQuickRepeatCardSurface,
  runQuickRepeatNativeCardCheckout,
} from "@/components/front/checkin/quick-repeat-card"
import { KioskQuickRepeatOverlay } from "@/components/front/checkin/KioskQuickRepeatOverlay"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const reference = "A".repeat(43)
const READER_UNRESPONSIVE = "The card reader did not respond. Please try again or choose another payment method."
const PREPARE_FAILED = "We couldn't prepare native payment. Please try again."

type BridgeWindow = { pliNativeBridge?: { postMessage: (message: string) => void; onmessage?: ((event: { data: unknown }) => void) | null } }

const installBridge = (respond: (request: { operation: string; requestId: string }) => Record<string, unknown> | null) => {
  const postMessage = vi.fn((raw: string) => {
    const request = JSON.parse(raw)
    const payload = respond(request)
    if (!payload) return
    ;(window as unknown as BridgeWindow).pliNativeBridge?.onmessage?.({
      data: JSON.stringify({ version: 1, operation: request.operation, requestId: request.requestId, payload }),
    })
  })
  ;(window as unknown as BridgeWindow).pliNativeBridge = { postMessage }
  return postMessage
}

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as unknown as Response

const bootstrapFixture = (override: Partial<BootstrapResponse> = {}): BootstrapResponse => ({
  context: {
    courseSlug: "salsa",
    courseTitle: "Salsa",
    date: "2026-10-22",
    time: "19:00",
    durationMinutes: 60,
    startsAt: "2026-10-22T23:00:00Z",
    endsAt: "2026-10-23T00:00:00Z",
    checkInWindow: { isOpen: true, opensAt: "", closesAt: "" },
  },
  customer: { firstName: "Jane", lastName: "Doe", name: "Jane Doe", email: "jane@example.com", phone: "+15551234567" },
  lastPurchasePattern: { amount: 2000, paymentChannel: "card" },
  consecutiveOffer: null,
  ...override,
}) as unknown as BootstrapResponse

const payload = () => buildQuickRepeatCardPayload({
  bootstrap: bootstrapFixture(),
  consecutiveAccepted: false,
  kioskSessionToken: "kiosk_session_1",
})

const callbacks = () => ({
  setProcessing: vi.fn(),
  setError: vi.fn(),
  onPaid: vi.fn(),
  onComplete: vi.fn(),
})

afterEach(() => {
  delete (window as unknown as BridgeWindow).pliNativeBridge
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("resolveQuickRepeatCardSurface", () => {
  it("keeps the hosted QR checkout when the native bridge is unavailable", () => {
    expect(resolveQuickRepeatCardSurface()).toBe("hosted_qr")
  })

  it("routes card payment to the native M2 reader when the bridge is available", () => {
    installBridge(() => null)
    expect(resolveQuickRepeatCardSurface()).toBe("native_m2")
  })
})

describe("buildQuickRepeatCardPayload", () => {
  it("builds the existing Quick Repeat card payload from bootstrap data", () => {
    expect(payload()).toEqual({
      courseSlug: "salsa",
      courseTitle: "Salsa",
      amount: 2000,
      currency: "usd",
      date: "2026-10-22",
      time: "19:00",
      serviceId: "dropin",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "+15551234567",
      participants: 1,
      photoContext: "kiosk_terminal",
      kioskSessionToken: "kiosk_session_1",
    })
  })

  it("adds the accepted consecutive promotion to the total", () => {
    const built = buildQuickRepeatCardPayload({
      bootstrap: bootstrapFixture({
        consecutiveOffer: { dropInConsecutiveCents: 1000, linkedCourseSlug: "bachata", linkedCourseTitle: "Bachata", linkedCourseTime: null } as unknown as BootstrapResponse["consecutiveOffer"],
      }),
      consecutiveAccepted: true,
      kioskSessionToken: null,
    })
    expect(built).toMatchObject({
      amount: 3000,
      consecutivePriceCents: 1000,
      consecutiveLinkedCourseSlug: "bachata",
      consecutiveCourseTitle: "Bachata",
      consecutiveLinkedCourseTime: "19:00",
    })
    expect(built).not.toHaveProperty("kioskSessionToken")
  })
})

describe("runQuickRepeatNativeCardCheckout", () => {
  it("refreshes the prepared context, prepares the native purchase, never creates a hosted session, and completes five seconds after PAID", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      return body.prepareOnly
        ? jsonResponse({ ok: true, prepareOnly: true, account: { hasAvatar: true }, source: "prepared", preparedContextRefreshed: true })
        : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
    })
    const postMessage = installBridge((request) => request.operation === "startPreparedPurchase"
      ? { operationReference: "op_1", state: "accepted" }
      : { operationReference: "op_1", state: "paid" })
    const cb = callbacks()

    await runQuickRepeatNativeCardCheckout({ payload: payload(), kioskCurrentCourseDuration: 60, fetchImpl: fetchMock as unknown as typeof fetch, ...cb })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/checkout/intent", "/api/checkout/intent"])
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string))).toMatchObject([
      { prepareOnly: true, paymentSurface: "embedded", refreshKioskPreparedContext: true, kioskCurrentCourseDuration: 60, kioskSessionToken: "kiosk_session_1", amount: 2000 },
      { paymentSurface: "native_m2_prepare", kioskCurrentCourseDuration: 60, kioskSessionToken: "kiosk_session_1", amount: 2000, serviceId: "dropin" },
    ])
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).not.toHaveProperty("prepareOnly")
    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(cb.onPaid).toHaveBeenCalledTimes(1)
    expect(cb.setError).not.toHaveBeenCalledWith(expect.any(String))
    expect(cb.onComplete).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(cb.onComplete).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(cb.onComplete).toHaveBeenCalledTimes(1)
  })

  it("releases a rejected reader outcome with a visible error and no success, QR fallback, or re-preparation", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      return body.prepareOnly
        ? jsonResponse({ ok: true, preparedContextRefreshed: true })
        : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
    })
    installBridge((request) => request.operation === "startPreparedPurchase"
      ? { operationReference: "op_1", state: "accepted" }
      : { operationReference: "op_1", state: "rejected" })
    const cb = callbacks()

    await runQuickRepeatNativeCardCheckout({ payload: payload(), kioskCurrentCourseDuration: 60, fetchImpl: fetchMock as unknown as typeof fetch, ...cb })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(([url]) => url === "/api/checkout/intent")).toBe(true)
    expect(cb.setError).toHaveBeenLastCalledWith(READER_UNRESPONSIVE)
    expect(cb.setProcessing).toHaveBeenLastCalledWith(false)
    expect(cb.onPaid).not.toHaveBeenCalled()
    expect(cb.onComplete).not.toHaveBeenCalled()
  })

  it("stops before the reader when native preparation fails", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      return body.prepareOnly
        ? jsonResponse({ ok: true, preparedContextRefreshed: true })
        : jsonResponse({ error: "Native preparation unavailable" }, 409)
    })
    const postMessage = installBridge(() => null)
    const cb = callbacks()

    await runQuickRepeatNativeCardCheckout({ payload: payload(), kioskCurrentCourseDuration: 60, fetchImpl: fetchMock as unknown as typeof fetch, ...cb })

    expect(postMessage).not.toHaveBeenCalled()
    expect(cb.setError).toHaveBeenLastCalledWith(PREPARE_FAILED)
    expect(cb.setProcessing).toHaveBeenLastCalledWith(false)
    expect(cb.onPaid).not.toHaveBeenCalled()
  })

  it("stops before native preparation when the prepared context refresh fails", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Kiosk session required for prepared context refresh" }, 400))
    const postMessage = installBridge(() => null)
    const cb = callbacks()

    await runQuickRepeatNativeCardCheckout({ payload: payload(), kioskCurrentCourseDuration: 60, fetchImpl: fetchMock as unknown as typeof fetch, ...cb })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(postMessage).not.toHaveBeenCalled()
    expect(cb.setError).toHaveBeenLastCalledWith(PREPARE_FAILED)
    expect(cb.setProcessing).toHaveBeenLastCalledWith(false)
  })
})

describe("KioskQuickRepeatOverlay native card error", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
    root = null
    container = null
  })

  it("shows the card error while keeping the payment choices available", () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root?.render(
        <KioskQuickRepeatOverlay
          bootstrap={bootstrapFixture()}
          qrCheckout={{ ...createEmptyKioskQrCheckoutState(), error: READER_UNRESPONSIVE }}
          onConfirm={() => undefined}
          onDecline={() => undefined}
          isProcessing={false}
          success={false}
        />
      )
    })

    expect(container.querySelector("[role='alert']")?.textContent).toBe(READER_UNRESPONSIVE)
    const buttons = Array.from(container.querySelectorAll("button")).filter((button) => /Pay (Cash|by Card)/.test(button.textContent ?? ""))
    expect(buttons).toHaveLength(2)
    expect(buttons.every((button) => !button.disabled)).toBe(true)
    expect(container.textContent).not.toContain("QR code will appear here.")
  })
})
