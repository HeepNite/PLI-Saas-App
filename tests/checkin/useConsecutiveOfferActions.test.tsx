// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useConsecutiveOfferActions } from "@/components/front/checkin/hooks/useConsecutiveOfferActions"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useConsecutiveOfferActions>[0]
type HookResult = ReturnType<typeof useConsecutiveOfferActions>

const offer: ConsecutiveOffer = {
  linkedCourseSlug: "bachata",
  linkedCourseTitle: "Bachata",
  linkedCourseTime: "21:00",
  dropInConsecutiveCents: 1200,
  packageHolderConsecutiveCents: 500,
  regularDropInCents: 1800,
  discountPercent: 33,
  hasAttendedFirstClass: true,
}

const bootstrap = {
  context: { courseSlug: "salsa", date: "2026-06-04", time: "20:00" },
} as BootstrapResponse

const packageResult = { attendanceId: "att_1", remainingCredits: 2, points: 10 }

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  consecutiveOffer: offer,
  activeDate: "2026-06-04",
  activeTime: "20:00",
  durationMinutes: 60,
  getToken: vi.fn().mockResolvedValue("token-1"),
  bootstrap,
  photoFlowContext: "kiosk_terminal",
  hasActiveClerkSession: true,
  kioskPinSessionToken: "",
  packageCheckInResult: null,
  currentCheckInCourseSlug: "salsa",
  performPackageCheckInApi: vi.fn().mockResolvedValue(packageResult),
  openExistingPurchaseFlow: vi.fn(),
  handleStationCompletion: vi.fn(),
  hasUsablePackageForCurrentClass: true,
  setAwaitingConsecutivePaymentSelection: vi.fn(),
  setConsecutiveError: vi.fn(),
  setConsecutiveOffer: vi.fn(),
  setConsecutiveProcessing: vi.fn(),
  setConsecutiveProcessingAction: vi.fn(),
  setConsecutiveSuccess: vi.fn(),
  setPackageCheckInResult: vi.fn(),
  setShowConsecutiveOverlay: vi.fn(),
  setShowConsecutivePaymentSelection: vi.fn(),
  requestPackageCheckIn: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: {} }),
  requestDropInCheckIn: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: {} }),
  ...override,
})

describe("useConsecutiveOfferActions", () => {
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
      result = useConsecutiveOfferActions(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("routes package-holder positive accept through payment selection without direct add-on", async () => {
    const { params, getResult } = await mount(defaultParams({
      packageCheckInResult: packageResult,
      consecutiveOffer: { ...offer, packageHolderConsecutiveCents: 500 },
    }))

    await act(async () => getResult().handleConsecutiveAccept())

    expect(params.requestPackageCheckIn).not.toHaveBeenCalled()
    expect(params.performPackageCheckInApi).not.toHaveBeenCalled()
    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(true)
    expect(params.setConsecutiveError).toHaveBeenCalledWith(null)
  })

  it("pre-checks in package holder before paid consecutive payment selection", async () => {
    const { params, getResult } = await mount(defaultParams({ packageCheckInResult: null }))

    await act(async () => getResult().handleConsecutiveAccept())

    expect(params.performPackageCheckInApi).toHaveBeenCalled()
    expect(params.requestPackageCheckIn).not.toHaveBeenCalled()
    expect(params.setPackageCheckInResult).toHaveBeenCalledWith(packageResult)
    expect(params.setAwaitingConsecutivePaymentSelection).toHaveBeenCalledWith(true)
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
  })

  it("directly adds a free package-holder consecutive class", async () => {
    const { params, getResult } = await mount(defaultParams({
      packageCheckInResult: packageResult,
      consecutiveOffer: { ...offer, packageHolderConsecutiveCents: 0 },
    }))

    await act(async () => getResult().handleConsecutiveAccept())

    expect(params.requestPackageCheckIn).toHaveBeenCalledWith({
      token: "token-1",
      payload: expect.objectContaining({
        courseSlug: "bachata",
        consecutiveAddOn: true,
        linkedFromCourseSlug: "salsa",
        linkedFromAttendanceId: "att_1",
        consecutivePriceCents: 0,
      }),
    })
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(params.setConsecutiveSuccess).toHaveBeenCalledWith({ courseTitle: "Bachata" })
  })

  it("decline checks in class A before closing overlay when package result is missing", async () => {
    const { params, getResult } = await mount(defaultParams({ packageCheckInResult: null }))

    await act(async () => getResult().handleConsecutiveDecline())

    expect(params.performPackageCheckInApi).toHaveBeenCalled()
    expect(params.setPackageCheckInResult).toHaveBeenCalledWith(packageResult)
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
    expect(params.handleStationCompletion).not.toHaveBeenCalled()
  })

  it("accepts a drop-in consecutive offer with the drop-in discount payload", async () => {
    const { params, getResult } = await mount(defaultParams({ hasUsablePackageForCurrentClass: false }))

    await act(async () => getResult().handleConsecutiveAccept())

    expect(params.requestDropInCheckIn).toHaveBeenCalledWith({
      token: "token-1",
      payload: expect.objectContaining({
        courseSlug: "bachata",
        consecutiveDiscountApplied: true,
        linkedFromCourseSlug: "salsa",
        consecutivePriceCents: 1200,
      }),
    })
    expect(params.openExistingPurchaseFlow).not.toHaveBeenCalled()
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(params.setConsecutiveSuccess).toHaveBeenCalledWith({ courseTitle: "Bachata" })
  })

  it("decline falls back to existing purchase flow when no usable package is available", async () => {
    const { params, getResult } = await mount(defaultParams({ hasUsablePackageForCurrentClass: false }))

    await act(async () => getResult().handleConsecutiveDecline())

    expect(params.openExistingPurchaseFlow).toHaveBeenCalledWith({
      courseSlug: "salsa",
      date: "2026-06-04",
      time: "20:00",
    })
  })
})
