// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useCheckInBootstrap } from "@/components/front/checkin/hooks/useCheckInBootstrap"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useCheckInBootstrap>[0]
type HookResult = ReturnType<typeof useCheckInBootstrap>

const activePackage = { id: "purchase-1", packageId: "pkg-1", packageLabel: "5 classes", isUnlimited: false, remainingCredits: 3, expiresAt: null, status: "active" }
const contextPayload = { courseSlug: "salsa", date: "2026-06-03", time: "20:00", durationMinutes: 60, linkedFromCourseSlug: "salsa" }
const consecutiveOffer = { linkedCourseSlug: "bachata", linkedCourseTitle: "Bachata", dropInConsecutiveCents: 1000, packageHolderConsecutiveCents: 500, regularDropInCents: 1500, discountPercent: 33, hasAttendedFirstClass: true }
const bootstrapData = (override: Partial<BootstrapResponse> = {}): BootstrapResponse => ({
  context: { ...contextPayload, courseTitle: "Salsa", startsAt: "", endsAt: "", checkInWindow: { isOpen: true, opensAt: "", closesAt: "" } },
  customer: { userId: "u1", clerkUserId: "c1", firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace", email: "ada@test.dev", phone: "123", hasAvatar: true },
  package: activePackage,
  packages: [], quickCheckout: null, purchaseHistory: [], hasPreviousPurchase: false, hasAnyCompletedPurchase: false,
  ...override,
})

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  contextIsValid: true,
  contextPayload,
  getToken: vi.fn().mockResolvedValue("token-1"),
  hasActiveClerkSession: true,
  kioskPinSessionToken: "",
  photoFlowContext: "kiosk_terminal",
  setError: vi.fn(),
  setConsecutiveOffer: vi.fn(),
  setShowConsecutiveOverlay: vi.fn(),
  setShowConsecutivePaymentSelection: vi.fn(),
  requestBootstrap: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: bootstrapData({ consecutiveOffer }) }),
  ...override,
})

describe("useCheckInBootstrap", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
    vi.restoreAllMocks()
  })

  const mount = async (params = defaultParams()) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      result = useCheckInBootstrap(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("loads bootstrap with token, payload, and flow context", async () => {
    const { params, getResult } = await mount()

    await act(async () => getResult().loadBootstrap())

    expect(params.requestBootstrap).toHaveBeenCalledWith({
      token: "token-1",
      payload: { ...params.contextPayload, flowContext: "kiosk_terminal" },
    })
    expect(getResult().bootstrap?.context.courseSlug).toBe("salsa")
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(expect.objectContaining({ linkedCourseSlug: "bachata" }))
  })

  it("adds kiosk session token when there is no active Clerk session", async () => {
    const params = defaultParams({ hasActiveClerkSession: false, kioskPinSessionToken: "kiosk-token" })
    const { getResult } = await mount(params)

    await act(async () => getResult().loadBootstrap())

    expect(params.requestBootstrap).toHaveBeenCalledWith({
      token: "token-1",
      payload: { ...params.contextPayload, flowContext: "kiosk_terminal", kioskSessionToken: "kiosk-token" },
    })
  })

  it("preserves no-session gating by not loading without Clerk session or kiosk token", async () => {
    const params = defaultParams({ hasActiveClerkSession: false, kioskPinSessionToken: "" })
    const { getResult } = await mount(params)

    await act(async () => getResult().loadBootstrap())

    expect(params.requestBootstrap).not.toHaveBeenCalled()
    expect(getResult().loadingBootstrap).toBe(false)
  })

  it("clears bootstrap and surfaces API error on non-ok responses", async () => {
    const params = defaultParams({
      requestBootstrap: vi.fn().mockResolvedValue({ res: { ok: false } as Response, data: { error: "Not allowed." } }),
    })
    const { getResult } = await mount(params)

    await act(async () => getResult().loadBootstrap())

    expect(getResult().bootstrap).toBeNull()
    expect(params.setError).toHaveBeenCalledWith("Not allowed.")
    expect(getResult().loadingBootstrap).toBe(false)
  })

  it("clears bootstrap and suppresses visible errors when the request throws", async () => {
    const params = defaultParams({ requestBootstrap: vi.fn().mockRejectedValue(new Error("network down")) })
    const { getResult } = await mount(params)

    await act(async () => getResult().loadBootstrap())

    expect(getResult().bootstrap).toBeNull()
    expect(params.setError).toHaveBeenCalledWith(null)
    expect(getResult().loadingBootstrap).toBe(false)
  })

  it("hides consecutive overlay/payment selection but keeps the prefetch offer when the loaded package is not usable", async () => {
    // No-credit / no-package customers should not see the consecutive overlay,
    // but the terminal prefetch offer must remain available for the EnrollModal
    // purchase/drop-in flow, so setConsecutiveOffer is NOT called.
    const params = defaultParams({ requestBootstrap: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: bootstrapData({ package: { ...activePackage, remainingCredits: 0, packageLabel: "empty" } }) }) })
    const { getResult } = await mount(params)

    await act(async () => getResult().loadBootstrap())

    // The terminal prefetch offer must remain available for the EnrollModal
    // purchase/drop-in flow, so setConsecutiveOffer is intentionally not
    // reset to null — only the overlay/payment-selection UI is cleared.
    expect(params.setConsecutiveOffer).not.toHaveBeenCalled()
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(false)
  })
})
