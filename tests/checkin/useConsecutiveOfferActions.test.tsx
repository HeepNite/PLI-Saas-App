// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useConsecutiveOfferActions } from "@/components/front/checkin/hooks/useConsecutiveOfferActions"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"
import type { CourseData } from "@/constants/courses"

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
  customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+15555550123" },
} as BootstrapResponse

const sourceCourses = [
  {
    slug: "bachata",
    title: "Bachata",
    description: "Bachata class",
    level: "Beginner",
    duration: "60 min",
    schedule: { day: "Thursday", time: "21:00", starts: "2026-06-04T21:00:00.000Z" },
    location: { address: "Studio" },
    instructors: [],
    enrollment: { services: [{ id: "svc_bachata", label: "Drop-in" }], packages: [] },
  },
] satisfies CourseData[]

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
  sourceCourses,
  performPackageCheckInApi: vi.fn().mockResolvedValue(packageResult),
  openExistingPurchaseFlow: vi.fn(),
  handleStationCompletion: vi.fn(),
  hasUsablePackageForCurrentClass: true,
  isKioskTerminalFlow: true,
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
  requestCheckoutSession: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: { url: "https://pay.test/qr", sessionId: "cs_1", expiresAt: "2026-06-04T22:00:00.000Z" } }),
  setConsecutiveQrCheckout: vi.fn(),
  setShowDuplicatePurchasePopup: vi.fn(),
  refreshConsecutiveOffer: vi.fn(),
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

  it("accept surfaces a classified error via setConsecutiveError when the pre-checkin package check-in fails (union narrowing)", async () => {
    const failure = { kind: "server" as const, message: "We couldn't check you in. Please see the front desk." }
    const { params, getResult } = await mount(defaultParams({
      packageCheckInResult: null,
      performPackageCheckInApi: vi.fn().mockResolvedValue(failure),
    }))

    await act(async () => getResult().handleConsecutiveAccept())

    expect(params.setConsecutiveError).toHaveBeenCalledWith(failure.message)
    expect(params.setPackageCheckInResult).not.toHaveBeenCalled()
    expect(params.setAwaitingConsecutivePaymentSelection).not.toHaveBeenCalled()
    expect(params.setShowConsecutiveOverlay).not.toHaveBeenCalled()
  })

  it("decline surfaces a classified error via setConsecutiveError when the pre-checkin package check-in fails (union narrowing)", async () => {
    const failure = { kind: "no_credits" as const, message: "This package has no credits left." }
    const { params, getResult } = await mount(defaultParams({
      packageCheckInResult: null,
      performPackageCheckInApi: vi.fn().mockResolvedValue(failure),
    }))

    await act(async () => getResult().handleConsecutiveDecline())

    expect(params.setConsecutiveError).toHaveBeenCalledWith(failure.message)
    expect(params.setPackageCheckInResult).not.toHaveBeenCalled()
    expect(params.setConsecutiveOffer).not.toHaveBeenCalled()
    expect(params.setShowConsecutiveOverlay).not.toHaveBeenCalled()
    expect(params.handleStationCompletion).not.toHaveBeenCalled()
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

  it("processes cash package add-on payment with linked attendance", async () => {
    const { params, getResult } = await mount(defaultParams({ packageCheckInResult: packageResult }))

    await act(async () => getResult().handleConsecutivePayCash())

    expect(params.requestPackageCheckIn).toHaveBeenCalledWith({
      token: "token-1",
      payload: expect.objectContaining({
        courseSlug: "bachata",
        paymentMethod: "cash",
        consecutiveAddOn: true,
        consecutiveCashPayment: true,
        linkedFromCourseSlug: "salsa",
        linkedFromAttendanceId: "att_1",
        consecutivePriceCents: 500,
      }),
    })
    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(false)
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(params.handleStationCompletion).toHaveBeenCalled()
  })

  it("cash payment falls back to existing purchase flow when no usable package is available", async () => {
    const { params, getResult } = await mount(defaultParams({ hasUsablePackageForCurrentClass: false }))

    await act(async () => getResult().handleConsecutivePayCash())

    expect(params.requestDropInCheckIn).not.toHaveBeenCalled()
    expect(params.openExistingPurchaseFlow).toHaveBeenCalledWith({
      courseSlug: "salsa",
      date: "2026-06-04",
      time: "20:00",
    })
  })

  it("starts card QR checkout with linked course and customer payload", async () => {
    const { params, getResult } = await mount(defaultParams({ packageCheckInResult: packageResult }))

    await act(async () => getResult().handleConsecutivePayCard())

    expect(params.requestCheckoutSession).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        courseSlug: "bachata",
        courseTitle: "Bachata",
        amount: 500,
        serviceId: "svc_bachata",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "+15555550123",
        consecutiveAddOnOnly: true,
        linkedFromCourseSlug: "salsa",
        linkedFromAttendanceId: "att_1",
        consecutivePriceCents: 500,
        consecutiveLinkedCourseSlug: "bachata",
        consecutiveCourseTitle: "Bachata",
        consecutiveLinkedCourseTime: "21:00",
      }),
    })
    expect(params.setConsecutiveQrCheckout).toHaveBeenCalledWith(expect.objectContaining({ phase: "creating" }))
    expect(params.setConsecutiveQrCheckout).toHaveBeenCalledWith(expect.objectContaining({ phase: "qr_ready", sessionId: "cs_1", url: "https://pay.test/qr" }))
  })

  it("cancels and completes QR checkout with the existing reset behavior", async () => {
    const { params, getResult } = await mount()

    act(() => getResult().handleConsecutiveQrCancel())
    act(() => getResult().handleConsecutiveQrComplete())

    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(true)
    expect(params.setConsecutiveQrCheckout).toHaveBeenCalled()
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
    expect(params.refreshConsecutiveOffer).toHaveBeenCalled()
    expect(params.handleStationCompletion).toHaveBeenCalled()
  })
})
