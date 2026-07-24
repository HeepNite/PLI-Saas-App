// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEnrollInit } from "@/components/front/courses/enroll/hooks/useEnrollInit"
import { computeCheckInAutofill } from "@/components/front/courses/enroll/model/checkin-autofill"

vi.mock("@/components/front/courses/enroll/model/checkin-autofill", () => ({
  computeCheckInAutofill: vi.fn(() => ({ date: "2026-06-26", time: "18:00", notice: null })),
}))

type HookResult = ReturnType<typeof useEnrollInit>
type HookProps = Parameters<typeof useEnrollInit>[0]

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const defaultProps = (override: Partial<HookProps> = {}): HookProps => ({
  open: true,
  prefillContact: { firstName: "Ana", phone: "+1 917 555 1212" },
  prefillSelection: { service: "regular", participants: 2 },
  userContact: { firstName: "User", email: "user@example.com", phone: "+1 929 555 1212" },
  setKioskStepHydrating: vi.fn(),
  course: { slug: "intro-salsa", enrollment: { packages: [{ id: "drop-in" }], addons: [{ id: "shoes" }] } } as HookProps["course"],
  sourceCourses: [],
  availableServices: [{ id: "regular" }, { id: "new-student" }] as HookProps["availableServices"],
  draftKey: "pli-enroll:intro-salsa",
  useDraft: false,
  initialServiceId: "regular",
  isCheckInNewFlow: false,
  isCheckInFlow: false,
  isCheckInExistingFlow: false,
  isKioskTerminalFlow: false,
  isQrMobileCompactFlow: false,
  effectiveInitialStep: 0,
  kioskFastPathAdvanceTriggeredRef: { current: true },
  kioskFastPathSubmitTriggeredRef: { current: true },
  setService: vi.fn(), setPkg: vi.fn(), setAddons: vi.fn(), setParticipants: vi.fn(), setDate: vi.fn(), setTime: vi.fn(), setContact: vi.fn(),
  setCouponInput: vi.fn(), setAppliedCoupon: vi.fn(), setPaymentMethod: vi.fn(), setStep: vi.fn(), setCheckInScheduleNotice: vi.fn(),
  setRequiresSignIn: vi.fn(), setExistingAccountDetected: vi.fn(), setResumeAfterSignInStep: vi.fn(), setPendingAutoPay: vi.fn(), setIdentityCheckBusy: vi.fn(),
  setPhoneTouched: vi.fn(), setStripeClientSecret: vi.fn(), setShowStripeModal: vi.fn(), setKioskQrCheckout: vi.fn(), setFormError: vi.fn(),
  ...override,
})

describe("useEnrollInit", () => {
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

  const renderHook = async (props: HookProps) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextProps: HookProps) {
      result = useEnrollInit(nextProps)
      return null
    }

    await act(async () => root!.render(<Harness {...props} />))
    return {
      getResult: () => result!,
      rerender: async (nextProps: HookProps) => {
        await act(async () => root!.render(<Harness {...nextProps} />))
      },
    }
  }

  it("keeps the latest prefill and user contact in refs", async () => {
    const initial = defaultProps()
    const { getResult, rerender } = await renderHook(initial)

    expect(getResult().prefillContactRef.current?.firstName).toBe("Ana")
    expect(getResult().prefillSelectionRef.current?.service).toBe("regular")
    expect(getResult().userContactRef.current.email).toBe("user@example.com")

    await rerender(
      defaultProps({
        prefillContact: { firstName: "Bea" },
        prefillSelection: { service: "new-student", participants: 1 },
        userContact: { firstName: "Updated", email: "updated@example.com" },
      })
    )

    expect(getResult().prefillContactRef.current?.firstName).toBe("Bea")
    expect(getResult().prefillSelectionRef.current?.service).toBe("new-student")
    expect(getResult().userContactRef.current.email).toBe("updated@example.com")
  })

  it("resets initialization and kiosk hydration when closed", async () => {
    const setKioskStepHydrating = vi.fn()
    const { getResult, rerender } = await renderHook(defaultProps({ setKioskStepHydrating }))
    getResult().openInitializationRef.current = true

    await rerender(defaultProps({ open: false, setKioskStepHydrating }))

    expect(getResult().openInitializationRef.current).toBe(false)
    expect(setKioskStepHydrating).toHaveBeenLastCalledWith(false)
  })

  it("initializes a default booking from prefill selection and contact", async () => {
    const setContact = vi.fn(), setService = vi.fn(), setPkg = vi.fn(), setAddons = vi.fn(), setParticipants = vi.fn(), setStep = vi.fn()

    await renderHook(defaultProps({
      prefillContact: { firstName: "Ana", lastName: "Diaz", email: "ana@example.com", phone: "9175551212" },
      prefillSelection: { service: "regular", packageId: "drop-in", addons: ["shoes", "missing"], participants: 12 },
      effectiveInitialStep: 2, setContact, setService, setPkg, setAddons, setParticipants, setStep,
    }))

    expect(setService).toHaveBeenCalledWith("regular")
    expect(setPkg).toHaveBeenCalledWith("drop-in")
    expect(setAddons).toHaveBeenCalledWith(["shoes"])
    expect(setParticipants).toHaveBeenCalledWith(10)
    expect(setContact).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Ana", email: "ana@example.com" }))
    expect(setStep).toHaveBeenCalledWith(2)
  })

  it("initializes check-in new flow with empty contact and new-student service", async () => {
    const setContact = vi.fn(), setService = vi.fn(), setDate = vi.fn(), setTime = vi.fn()

    await renderHook(defaultProps({
      initialServiceId: "new-student", isCheckInNewFlow: true, isCheckInFlow: true, prefillSelection: undefined, setContact, setService, setDate, setTime,
    }))

    expect(setService).toHaveBeenCalledWith("new-student")
    expect(setContact).toHaveBeenCalledWith({ firstName: "", lastName: "", email: "", phone: "+1 ", note: "" })
    expect(setDate).toHaveBeenCalledWith("2026-06-26")
    expect(setTime).toHaveBeenCalledWith("18:00")
  })

  it("hydrates kiosk existing check-in until initialization finishes", async () => {
    const setKioskStepHydrating = vi.fn()

    await renderHook(defaultProps({ isCheckInFlow: true, isCheckInExistingFlow: true, isKioskTerminalFlow: true, setKioskStepHydrating }))

    expect(setKioskStepHydrating).toHaveBeenNthCalledWith(1, true)
    expect(setKioskStepHydrating).toHaveBeenLastCalledWith(false)
  })

  it("uses today-only autofill for QR mobile compact initialization", async () => {
    await renderHook(defaultProps({ isCheckInFlow: true, isQrMobileCompactFlow: true, checkInContextDate: "2026-06-27", checkInContextTime: "19:00" }))

    expect(vi.mocked(computeCheckInAutofill)).toHaveBeenCalledWith("intro-salsa", [], { date: "2026-06-27", time: "19:00" }, undefined, true)
  })
})
