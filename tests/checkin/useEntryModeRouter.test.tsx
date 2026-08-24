// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEntryModeRouter } from "@/components/front/checkin/hooks/useEntryModeRouter"
import { useCheckInBookingModalFlow } from "@/components/front/checkin/hooks/useCheckInBookingModalFlow"
import type { CourseData } from "@/constants/courses"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useEntryModeRouter>[0]
type HookResult = ReturnType<typeof useEntryModeRouter>

const selectedCourse = { slug: "salsa" }
const latePaymentRecommendation = { courseSlug: "salsa", date: "2026-06-04", time: "20:00" }

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  activeDate: "2026-06-04",
  activeTime: "20:00",
  activeSessionId: "sess_1",
  bootstrap: { context: { courseSlug: "salsa", date: "2026-06-04", time: "20:00" }, package: null } as HookParams["bootstrap"],
  checkConsecutiveOfferAfterCheckIn: vi.fn().mockResolvedValue(false),
  clearSuppressedClerkSessionId: vi.fn(),
  clerkSignOut: vi.fn(),
  consecutiveOfferSettled: true,
  contextIsValid: true,
  displayLatePaymentQrLink: "https://pay.test/late",
  durationMinutes: 75,
  effectiveCheckInWindowOpen: true,
  forceRedirectUrl: "/checkin?courseSlug=salsa",
  handlePackageCheckIn: vi.fn(),
  handleStationCompletion: vi.fn(),
  hasActiveClerkSession: true,
  isKioskTerminalFlow: false,
  latePaymentRecommendation,
  loadBootstrap: vi.fn(),
  mode: "idle",
  openExistingPurchaseFlow: vi.fn(),
  pendingNewBooking: false,
  processingPackageCheckIn: false,
  refreshConsecutiveOffer: vi.fn(),
  registerKioskClerkSession: vi.fn(),
  reloadCatalogCourses: vi.fn(),
  resetKioskPinFlow: vi.fn(),
  selectedCourse,
  setBootstrap: vi.fn(),
  setConsecutiveOfferSettled: vi.fn(),
  setError: vi.fn(),
  setLatePaymentEntryOverride: vi.fn(),
  setMode: vi.fn(),
  setNewBookingOverride: vi.fn(),
  setOpenNewBooking: vi.fn(),
  setPendingLoginPhone: vi.fn(),
  setPendingNewBooking: vi.fn(),
  setReturnedFromNewStudentFlow: vi.fn(),
  setShowPhoneSignIn: vi.fn(),
  setSuccess: vi.fn(),
  ...override,
})

describe("useEntryModeRouter", () => {
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
      result = useEntryModeRouter(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("opens existing mode and loads bootstrap for an authenticated valid context", async () => {
    const { params, getResult } = await mount()

    act(() => getResult().handleExistingClick())

    expect(params.reloadCatalogCourses).toHaveBeenCalled()
    expect(params.setMode).toHaveBeenCalledWith("existing")
    expect(params.resetKioskPinFlow).toHaveBeenCalled()
    expect(params.loadBootstrap).toHaveBeenCalled()
  })

  it("loads an authenticated previous class with its exact promotion source context", async () => {
    const { params, getResult } = await mount()
    const previousClass = {
      courseSlug: "salsa-night-beginner",
      date: "2026-05-22",
      time: "20:10",
      durationMinutes: 55,
    }

    act(() => getResult().handleExistingClick(previousClass))

    expect(params.setLatePaymentEntryOverride).toHaveBeenCalledWith(previousClass)
    expect(params.loadBootstrap).toHaveBeenCalledWith({
      ...previousClass,
      linkedFromCourseSlug: "salsa-night-beginner",
    })
  })

  it("opens phone sign-in for unauthenticated non-kiosk existing flow", async () => {
    const { params, getResult } = await mount(defaultParams({ hasActiveClerkSession: false }))

    act(() => getResult().handleExistingClick())

    expect(params.setShowPhoneSignIn).toHaveBeenCalledWith(true)
    expect(params.loadBootstrap).not.toHaveBeenCalled()
  })

  it("opens new booking immediately while consecutive offer lookup is unsettled", async () => {
    const { params, getResult } = await mount(defaultParams({ consecutiveOfferSettled: false }))

    act(() => getResult().handleNewClick())

    expect(params.setNewBookingOverride).toHaveBeenCalledWith({ courseSlug: "salsa", date: "2026-06-04", time: "20:00" })
    expect(params.setOpenNewBooking).toHaveBeenCalledWith(true)
    expect(params.setPendingNewBooking).not.toHaveBeenCalled()
  })

  it("rejects new booking when course context is missing", async () => {
    const { params, getResult } = await mount(defaultParams({
      consecutiveOfferSettled: false,
      contextIsValid: false,
      selectedCourse: null,
    }))

    act(() => getResult().handleNewClick())

    expect(params.setError).toHaveBeenLastCalledWith("We couldn't open the purchase because QR data is missing.")
    expect(params.setNewBookingOverride).not.toHaveBeenCalled()
    expect(params.setOpenNewBooking).not.toHaveBeenCalled()
  })

  it("uses retained duration in new and existing booking contexts", async () => {
    const ignored = vi.fn()
    const previous = { courseSlug: "beginner", date: "2026-05-22", time: "20:10", durationMinutes: 55 }
    let contexts: unknown
    function BookingHarness() {
      const result = useCheckInBookingModalFlow({
        sourceCourses: [{ slug: "beginner", enrollment: { services: [], packages: [] } } as unknown as CourseData], selectedCourse: null, qrCourse: null,
        activeDate: "2026-05-22", activeTime: "21:10", durationMinutes: 75,
        bootstrap: null, hasBootstrapPrefilledContact: false,
        photoFlowContext: "kiosk_terminal", isKioskTerminalFlow: true,
        hasUsablePackageForCurrentClass: false, packageOfferSelectedId: null, consecutiveOffer: null,
        setExistingRegularBookingKey: ignored, setExistingRegularBookingOverride: ignored,
        setNewBookingOverride: ignored, setOpenNewBooking: ignored, setError: ignored,
        setSuccess: ignored, setPaymentsModalReady: ignored, setConsecutiveOffer: ignored,
        setShowConsecutiveOverlay: ignored, setShowConsecutivePaymentSelection: ignored,
        setShowDuplicatePurchasePopup: ignored, handleStationCompletion: ignored,
        checkConsecutiveOfferAfterCheckIn: vi.fn().mockResolvedValue(false), refreshConsecutiveOffer: ignored,
        newBookingOverride: previous, existingRegularBookingOverride: previous,
      } as Parameters<typeof useCheckInBookingModalFlow>[0])
      contexts = [result.newBookingCourse?.slug, result.newBookingContext, result.existingRegularBookingContext]
      return null
    }
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root?.render(<BookingHarness />))

    expect(contexts).toEqual([
      "beginner",
      { date: "2026-05-22", time: "20:10", durationMinutes: 55 },
      { date: "2026-05-22", time: "20:10", durationMinutes: 55 },
    ])
  })

  it("routes late-payment existing flow through override and existing mode", async () => {
    const { params, getResult } = await mount()

    act(() => getResult().handleLatePaymentExisting())

    expect(params.setLatePaymentEntryOverride).toHaveBeenCalledWith(latePaymentRecommendation)
    expect(params.setMode).toHaveBeenCalledWith("existing")
  })

  it("after kiosk new-user purchase completes station when no consecutive offer exists", async () => {
    const { params, getResult } = await mount(defaultParams({ isKioskTerminalFlow: true }))

    await act(async () => getResult().handleNewUserPostPurchase())

    expect(params.checkConsecutiveOfferAfterCheckIn).toHaveBeenCalled()
    expect(params.refreshConsecutiveOffer).toHaveBeenCalled()
    expect(params.handleStationCompletion).toHaveBeenCalled()
  })
})
