// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEntryModeRouter } from "@/components/front/checkin/hooks/useEntryModeRouter"

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

  it("opens phone sign-in for unauthenticated non-kiosk existing flow", async () => {
    const { params, getResult } = await mount(defaultParams({ hasActiveClerkSession: false }))

    act(() => getResult().handleExistingClick())

    expect(params.setShowPhoneSignIn).toHaveBeenCalledWith(true)
    expect(params.loadBootstrap).not.toHaveBeenCalled()
  })

  it("defers new booking until consecutive offer fetch settles", async () => {
    const { params, getResult } = await mount(defaultParams({ consecutiveOfferSettled: false }))

    act(() => getResult().handleNewClick())

    expect(params.setNewBookingOverride).toHaveBeenCalledWith({ courseSlug: "salsa", date: "2026-06-04", time: "20:00" })
    expect(params.setPendingNewBooking).toHaveBeenCalledWith(true)
    expect(params.setOpenNewBooking).not.toHaveBeenCalledWith(true)
  })

  it("preserves the selected past-class context when the bounded offer lookup releases booking", async () => {
    const selectedPastClass = { courseSlug: "bachata", date: "2026-06-03", time: "18:00" }
    const { params, getResult } = await mount(defaultParams({ consecutiveOfferSettled: true }))

    act(() => getResult().handleNewClick(selectedPastClass))

    expect(params.setNewBookingOverride).toHaveBeenCalledWith(selectedPastClass)
    expect(params.setOpenNewBooking).toHaveBeenCalledWith(true)
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

  // ─── PR3: non-kiosk handleBootstrapAction regression — shared handlePackageCheckIn,
  // single explicit attempt, no kiosk-only overlay/retry state (this hook never
  // receives packageCheckInFailure/packageCheckInAttempts/retryBackoffActive at all) ───

  describe("handleBootstrapAction (non-kiosk)", () => {
    it("routes a single explicit tap through the shared handlePackageCheckIn for a package holder", async () => {
      const { params, getResult } = await mount(
        defaultParams({
          isKioskTerminalFlow: false,
          bootstrap: {
            context: { courseSlug: "salsa", date: "2026-06-04", time: "20:00" },
            package: { id: "pkg-1" },
          } as HookParams["bootstrap"],
        })
      )

      act(() => getResult().handleBootstrapAction())

      expect(params.handlePackageCheckIn).toHaveBeenCalledTimes(1)
      expect(params.openExistingPurchaseFlow).not.toHaveBeenCalled()

      // A second explicit tap is a second single attempt — never an automatic
      // retry loop; this hook has no attempt counter or backoff state to gate it.
      act(() => getResult().handleBootstrapAction())
      expect(params.handlePackageCheckIn).toHaveBeenCalledTimes(2)
    })

    it("surfaces a closed check-in window via setError — never calls handlePackageCheckIn or a kiosk overlay", async () => {
      const { params, getResult } = await mount(
        defaultParams({
          isKioskTerminalFlow: false,
          effectiveCheckInWindowOpen: false,
        })
      )

      act(() => getResult().handleBootstrapAction())

      expect(params.setError).toHaveBeenCalledWith("The check-in window for this class is closed.")
      expect(params.handlePackageCheckIn).not.toHaveBeenCalled()
    })

    it("opens the existing-purchase flow (not handlePackageCheckIn) when the customer has no package", async () => {
      const { params, getResult } = await mount(
        defaultParams({
          isKioskTerminalFlow: false,
          bootstrap: {
            context: { courseSlug: "salsa", date: "2026-06-04", time: "20:00" },
            package: null,
          } as HookParams["bootstrap"],
        })
      )

      act(() => getResult().handleBootstrapAction())

      expect(params.openExistingPurchaseFlow).toHaveBeenCalledWith({
        courseSlug: "salsa",
        date: "2026-06-04",
        time: "20:00",
      })
      expect(params.handlePackageCheckIn).not.toHaveBeenCalled()
    })
  })
})
