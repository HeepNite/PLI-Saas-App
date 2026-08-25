// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEnrollSubmitActions } from "@/components/front/courses/enroll/hooks/useEnrollSubmitActions"
import type { UseEnrollSubmitActionsInput } from "@/components/front/courses/enroll/hooks/useEnrollSubmitActions"
import type { EnrollmentContact } from "@/components/front/courses/types"

type HookResult = ReturnType<typeof useEnrollSubmitActions>

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const defaultInput = (override: Partial<UseEnrollSubmitActionsInput> = {}): UseEnrollSubmitActionsInput => ({
  isKioskTerminalFlow: false,
  regularServicePrice: 49,
  signInPurpose: "existing",
  onCloseAction: vi.fn(),
  kioskPaymentTransitionTimeoutRef: { current: null },
  kioskPaymentTransitionStartedAtRef: { current: null },
  kioskFastPathAdvanceTriggeredRef: { current: false },
  kioskFastPathSubmitTriggeredRef: { current: false },
  setSuccess: vi.fn(),
  setSuccessMessage: vi.fn(),
  setAddons: vi.fn(),
  setParticipants: vi.fn(),
  setDate: vi.fn(),
  setTime: vi.fn(),
  setContact: vi.fn(),
  setStep: vi.fn(),
  setCheckInScheduleNotice: vi.fn(),
  setRequiresSignIn: vi.fn(),
  setExistingAccountDetected: vi.fn(),
  setResumeAfterSignInStep: vi.fn(),
  setPendingAutoPay: vi.fn(),
  setResumeContactFlowAfterSignIn: vi.fn(),
  setIdentityCheckBusy: vi.fn(),
  setPhoneTouched: vi.fn(),
  setActiveNumericField: vi.fn(),
  setKioskInfoPhase: vi.fn(),
  setStripeClientSecret: vi.fn(),
  setShowStripeModal: vi.fn(),
  setKioskQrCheckout: vi.fn(),
  setPreparedAccount: vi.fn(),
  setPhotoSaved: vi.fn(),
  setNewStudentFallbackPhoneKey: vi.fn(),
  setFlowPopup: vi.fn(),
  setSignInPurpose: vi.fn(),
  setFormError: vi.fn(),
  setProcessing: vi.fn(),
  setShowKioskPaymentTransition: vi.fn(),
  setConsecutiveAccepted: vi.fn(),
  setConsecutiveAddedCents: vi.fn(),
  setConsecutiveChoiceMade: vi.fn(),
  showRegularFallbackPopup: vi.fn(),
  ...override,
})

describe("useEnrollSubmitActions", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
  })

  const renderHook = async (input: UseEnrollSubmitActionsInput) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextInput: UseEnrollSubmitActionsInput) {
      result = useEnrollSubmitActions(nextInput)
      return null
    }

    await act(async () => root!.render(<Harness {...input} />))
    return {
      getResult: () => result!,
      rerender: async (nextInput: UseEnrollSubmitActionsInput) => {
        await act(async () => root!.render(<Harness {...nextInput} />))
      },
    }
  }

  describe("resetForm", () => {
    it("resets all form state setters to their default initial values (non-kiosk flow)", async () => {
      const setSuccess = vi.fn()
      const setSuccessMessage = vi.fn()
      const setAddons = vi.fn()
      const setParticipants = vi.fn()
      const setDate = vi.fn()
      const setTime = vi.fn()
      const setContact = vi.fn()
      const setStep = vi.fn()
      const setCheckInScheduleNotice = vi.fn()
      const setRequiresSignIn = vi.fn()
      const setExistingAccountDetected = vi.fn()
      const setResumeAfterSignInStep = vi.fn()
      const setPendingAutoPay = vi.fn()
      const setResumeContactFlowAfterSignIn = vi.fn()
      const setIdentityCheckBusy = vi.fn()
      const setPhoneTouched = vi.fn()
      const setActiveNumericField = vi.fn()
      const setKioskInfoPhase = vi.fn()
      const setStripeClientSecret = vi.fn()
      const setShowStripeModal = vi.fn()
      const setKioskQrCheckout = vi.fn()
      const setPreparedAccount = vi.fn()
      const setPhotoSaved = vi.fn()
      const setNewStudentFallbackPhoneKey = vi.fn()
      const setFlowPopup = vi.fn()
      const setSignInPurpose = vi.fn()
      const setFormError = vi.fn()
      const setProcessing = vi.fn()
      const setShowKioskPaymentTransition = vi.fn()
      const setConsecutiveAccepted = vi.fn()
      const setConsecutiveAddedCents = vi.fn()
      const setConsecutiveChoiceMade = vi.fn()

      const { getResult } = await renderHook(
        defaultInput({
          isKioskTerminalFlow: false,
          setSuccess, setSuccessMessage, setAddons, setParticipants, setDate, setTime,
          setContact, setStep, setCheckInScheduleNotice, setRequiresSignIn, setExistingAccountDetected,
          setResumeAfterSignInStep, setPendingAutoPay, setResumeContactFlowAfterSignIn,
          setIdentityCheckBusy, setPhoneTouched, setActiveNumericField, setKioskInfoPhase,
          setStripeClientSecret, setShowStripeModal, setKioskQrCheckout, setPreparedAccount,
          setPhotoSaved, setNewStudentFallbackPhoneKey, setFlowPopup, setSignInPurpose,
          setFormError, setProcessing, setShowKioskPaymentTransition, setConsecutiveAccepted,
          setConsecutiveAddedCents, setConsecutiveChoiceMade,
        })
      )

      act(() => getResult().resetForm())

      expect(setSuccess).toHaveBeenCalledWith(false)
      expect(setSuccessMessage).toHaveBeenCalledWith(null)
      expect(setAddons).toHaveBeenCalledWith([])
      expect(setParticipants).toHaveBeenCalledWith(1)
      expect(setDate).toHaveBeenCalledWith("")
      expect(setTime).toHaveBeenCalledWith("")
      expect(setContact).toHaveBeenCalledWith({ firstName: "", lastName: "", email: "", phone: "+1 ", note: "" })
      expect(setStep).toHaveBeenCalledWith(0)
      expect(setCheckInScheduleNotice).toHaveBeenCalledWith(null)
      expect(setRequiresSignIn).toHaveBeenCalledWith(false)
      expect(setExistingAccountDetected).toHaveBeenCalledWith(false)
      expect(setResumeAfterSignInStep).toHaveBeenCalledWith(null)
      expect(setPendingAutoPay).toHaveBeenCalledWith(false)
      expect(setResumeContactFlowAfterSignIn).toHaveBeenCalledWith(false)
      expect(setIdentityCheckBusy).toHaveBeenCalledWith(false)
      expect(setPhoneTouched).toHaveBeenCalledWith(false)
      expect(setActiveNumericField).toHaveBeenCalledWith(null)
      expect(setKioskInfoPhase).toHaveBeenCalledWith("name-email")
      expect(setStripeClientSecret).toHaveBeenCalledWith("")
      expect(setShowStripeModal).toHaveBeenCalledWith(false)
      expect(setKioskQrCheckout).toHaveBeenCalledWith(expect.objectContaining({ phase: "idle" }))
      expect(setPreparedAccount).toHaveBeenCalledWith(null)
      expect(setPhotoSaved).toHaveBeenCalledWith(false)
      expect(setNewStudentFallbackPhoneKey).toHaveBeenCalledWith(null)
      expect(setFlowPopup).toHaveBeenCalledWith(null)
      expect(setSignInPurpose).toHaveBeenCalledWith("existing")
      expect(setFormError).toHaveBeenCalledWith(null)
      expect(setProcessing).toHaveBeenCalledWith(false)
      expect(setShowKioskPaymentTransition).toHaveBeenCalledWith(false)
      expect(setConsecutiveAccepted).toHaveBeenCalledWith(false)
      expect(setConsecutiveAddedCents).toHaveBeenCalledWith(0)
      expect(setConsecutiveChoiceMade).toHaveBeenCalledWith(false)
    })

    it("sets activeNumericField to 'phone' and kioskInfoPhase to 'phone' for kiosk terminal flow", async () => {
      const setActiveNumericField = vi.fn()
      const setKioskInfoPhase = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ isKioskTerminalFlow: true, setActiveNumericField, setKioskInfoPhase })
      )

      act(() => getResult().resetForm())

      expect(setActiveNumericField).toHaveBeenCalledWith("phone")
      expect(setKioskInfoPhase).toHaveBeenCalledWith("phone")
    })

    it("clears and nulls out the kiosk payment transition timeout ref if it was set", async () => {
      const kioskPaymentTransitionTimeoutRef: React.MutableRefObject<number | null> = { current: 42 }
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
      const { getResult } = await renderHook(defaultInput({ kioskPaymentTransitionTimeoutRef }))

      act(() => getResult().resetForm())

      expect(clearTimeoutSpy).toHaveBeenCalledWith(42)
      expect(kioskPaymentTransitionTimeoutRef.current).toBeNull()
      clearTimeoutSpy.mockRestore()
    })

    it("does not call clearTimeout when the kiosk payment transition timeout ref is already null", async () => {
      const kioskPaymentTransitionTimeoutRef: React.MutableRefObject<number | null> = { current: null }
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
      const { getResult } = await renderHook(defaultInput({ kioskPaymentTransitionTimeoutRef }))

      act(() => getResult().resetForm())

      expect(clearTimeoutSpy).not.toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it("resets the kiosk payment transition started-at ref and the kiosk fast-path triggered refs", async () => {
      const kioskPaymentTransitionStartedAtRef: React.MutableRefObject<number | null> = { current: 12345 }
      const kioskFastPathAdvanceTriggeredRef: React.MutableRefObject<boolean> = { current: true }
      const kioskFastPathSubmitTriggeredRef: React.MutableRefObject<boolean> = { current: true }
      const { getResult } = await renderHook(
        defaultInput({
          kioskPaymentTransitionStartedAtRef,
          kioskFastPathAdvanceTriggeredRef,
          kioskFastPathSubmitTriggeredRef,
        })
      )

      act(() => getResult().resetForm())

      expect(kioskPaymentTransitionStartedAtRef.current).toBeNull()
      expect(kioskFastPathAdvanceTriggeredRef.current).toBe(false)
      expect(kioskFastPathSubmitTriggeredRef.current).toBe(false)
    })
  })

  describe("handleClose", () => {
    it("resets the form and then calls onCloseAction", async () => {
      const callOrder: string[] = []
      const setSuccess = vi.fn(() => callOrder.push("resetForm"))
      const onCloseAction = vi.fn(() => callOrder.push("onCloseAction"))
      const { getResult } = await renderHook(defaultInput({ setSuccess, onCloseAction }))

      act(() => getResult().handleClose())

      expect(setSuccess).toHaveBeenCalledWith(false)
      expect(onCloseAction).toHaveBeenCalledTimes(1)
      expect(callOrder).toEqual(["resetForm", "onCloseAction"])
    })
  })

  describe("handleSignInDismiss", () => {
    it("clears sign-in related state without showing a fallback popup when signInPurpose is 'existing'", async () => {
      const setRequiresSignIn = vi.fn()
      const setExistingAccountDetected = vi.fn()
      const setResumeAfterSignInStep = vi.fn()
      const setPendingAutoPay = vi.fn()
      const setResumeContactFlowAfterSignIn = vi.fn()
      const setSignInPurpose = vi.fn()
      const showRegularFallbackPopup = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          signInPurpose: "existing",
          setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep,
          setPendingAutoPay, setResumeContactFlowAfterSignIn, setSignInPurpose,
          showRegularFallbackPopup,
        })
      )

      act(() => getResult().handleSignInDismiss())

      expect(setRequiresSignIn).toHaveBeenCalledWith(false)
      expect(setExistingAccountDetected).toHaveBeenCalledWith(false)
      expect(setResumeAfterSignInStep).toHaveBeenCalledWith(null)
      expect(setPendingAutoPay).toHaveBeenCalledWith(false)
      expect(setResumeContactFlowAfterSignIn).toHaveBeenCalledWith(false)
      expect(setSignInPurpose).toHaveBeenCalledWith("existing")
      expect(showRegularFallbackPopup).not.toHaveBeenCalled()
    })

    it("clears sign-in related state without showing a fallback popup when signInPurpose is 'account_preparation'", async () => {
      const showRegularFallbackPopup = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ signInPurpose: "account_preparation", showRegularFallbackPopup })
      )

      act(() => getResult().handleSignInDismiss())

      expect(showRegularFallbackPopup).not.toHaveBeenCalled()
    })

    it("shows the regular-price fallback popup with the rounded regular service price when signInPurpose is 'sms_verification'", async () => {
      const showRegularFallbackPopup = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ signInPurpose: "sms_verification", regularServicePrice: 49.99, showRegularFallbackPopup })
      )

      act(() => getResult().handleSignInDismiss())

      expect(showRegularFallbackPopup).toHaveBeenCalledWith(
        "Phone verification was not completed. We switched this booking to the regular $50 price."
      )
    })

    it("resets signInPurpose to 'existing' even when it was 'sms_verification'", async () => {
      const setSignInPurpose = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ signInPurpose: "sms_verification", setSignInPurpose })
      )

      act(() => getResult().handleSignInDismiss())

      expect(setSignInPurpose).toHaveBeenCalledWith("existing")
    })
  })
})
