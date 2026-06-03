// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useConsecutiveOfferLookup } from "@/components/front/checkin/hooks/useConsecutiveOfferLookup"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useConsecutiveOfferLookup>[0]
type HookResult = ReturnType<typeof useConsecutiveOfferLookup>

const offer = { linkedCourseSlug: "bachata", linkedCourseTitle: "Bachata", dropInConsecutiveCents: 1000, packageHolderConsecutiveCents: 500, regularDropInCents: 1500, discountPercent: 33, hasAttendedFirstClass: true }
const activePackage = { isUnlimited: false, remainingCredits: 2 }

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  isKioskTerminalFlow: true,
  activeCourseSlug: "salsa",
  activeDate: "2026-06-03",
  activeTime: "20:00",
  durationMinutes: 60,
  latePaymentEntryOverride: null,
  newBookingOverride: null,
  getToken: vi.fn().mockResolvedValue("token-1"),
  hasActiveClerkSession: true,
  kioskPinSessionToken: "",
  photoFlowContext: "kiosk_terminal",
  setConsecutiveOffer: vi.fn(),
  setShowConsecutivePaymentSelection: vi.fn(),
  setShowConsecutiveOverlay: vi.fn(),
  requestBootstrap: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: { package: activePackage, consecutiveOffer: offer } }),
  ...override,
})

describe("useConsecutiveOfferLookup", () => {
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
      result = useConsecutiveOfferLookup(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("loads a usable package consecutive offer and opens the overlay", async () => {
    const { params, getResult } = await mount()

    await expect(getResult().checkConsecutiveOfferAfterCheckIn()).resolves.toBe(true)

    expect(params.requestBootstrap).toHaveBeenCalledWith({
      token: "token-1",
      payload: { courseSlug: "salsa", date: "2026-06-03", time: "20:00", durationMinutes: 60, linkedFromCourseSlug: "salsa", flowContext: "kiosk_terminal" },
    })
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(offer)
    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(false)
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(true)
  })

  it("uses late-payment override and kiosk session token", async () => {
    const { params, getResult } = await mount(defaultParams({
      hasActiveClerkSession: false,
      kioskPinSessionToken: "kiosk-token",
      latePaymentEntryOverride: { courseSlug: "bachata", date: "2026-06-04", time: "18:30" },
    }))

    await getResult().checkConsecutiveOfferAfterCheckIn()

    expect(params.requestBootstrap).toHaveBeenCalledWith({
      token: "token-1",
      payload: { courseSlug: "bachata", date: "2026-06-04", time: "18:30", durationMinutes: 60, linkedFromCourseSlug: "bachata", flowContext: "kiosk_terminal", kioskSessionToken: "kiosk-token" },
    })
  })

  it("returns false without calling the API when required gates fail", async () => {
    const { params, getResult } = await mount(defaultParams({ isKioskTerminalFlow: false }))

    await expect(getResult().checkConsecutiveOfferAfterCheckIn()).resolves.toBe(false)

    expect(params.requestBootstrap).not.toHaveBeenCalled()
  })

  it("silently returns false when package is not usable", async () => {
    const { params, getResult } = await mount(defaultParams({ requestBootstrap: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: { package: { isUnlimited: false, remainingCredits: 0 }, consecutiveOffer: offer } }) }))

    await expect(getResult().checkConsecutiveOfferAfterCheckIn()).resolves.toBe(false)

    expect(params.setConsecutiveOffer).not.toHaveBeenCalled()
    expect(params.setShowConsecutiveOverlay).not.toHaveBeenCalled()
  })
})
