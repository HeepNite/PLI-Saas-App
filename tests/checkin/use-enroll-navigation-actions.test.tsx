// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEnrollNavigationActions } from "@/components/front/courses/enroll/hooks/useEnrollNavigationActions"
import type { UseEnrollNavigationActionsInput } from "@/components/front/courses/enroll/hooks/useEnrollNavigationActions"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { PreparedAccountState } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"

type HookResult = ReturnType<typeof useEnrollNavigationActions>

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const defaultContact = (): EnrollmentContact => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "+1 ",
  note: "",
})

const noPhotoPolicy = (): PhotoPolicy => ({
  context: "external_web",
  photoRequired: false,
  allowCameraCapture: false,
  allowGalleryUpload: false,
  uploadMode: "none",
})

const requiredSelfPhotoPolicy = (): PhotoPolicy => ({
  context: "kiosk_terminal",
  photoRequired: true,
  allowCameraCapture: true,
  allowGalleryUpload: false,
  uploadMode: "customer_self",
})

const preparedAccount = (override: Partial<PreparedAccountState> = {}): PreparedAccountState =>
  ({
    hasAvatar: false,
    requiresSignIn: false,
    ...override,
  }) as PreparedAccountState

const defaultInput = (override: Partial<UseEnrollNavigationActionsInput> = {}): UseEnrollNavigationActionsInput => ({
  service: "regular",
  contact: defaultContact(),
  isCheckInFlow: false,
  isKioskTerminalFlow: false,
  isQrMobileCompactFlow: false,
  isSignedIn: false,
  step: 0,
  steps: [
    { key: "info", label: "Info" },
    { key: "packages", label: "Packages" },
    { key: "payments", label: "Payments" },
  ],
  photoPolicy: noPhotoPolicy(),
  photoSaved: false,
  photoStepIndex: -1,
  promoStepIndex: -1,
  packagesStepIndex: 1,
  paymentsStepIndex: 2,
  usesPhasedInfoForm: false,
  activeStepKey: "info",
  kioskInfoPhase: "name-email",
  activeNumericField: null,
  preparedAccount: null,
  onExistingUserDetected: undefined,
  verifyNewStudent: vi.fn(async () => "eligible"),
  setContact: vi.fn(),
  setStep: vi.fn(),
  setFormError: vi.fn(),
  setRequiresSignIn: vi.fn(),
  setExistingAccountDetected: vi.fn(),
  setResumeAfterSignInStep: vi.fn(),
  setResumeContactFlowAfterSignIn: vi.fn(),
  setPendingAutoPay: vi.fn(),
  setSignInPurpose: vi.fn(),
  setIdentityCheckBusy: vi.fn(),
  setPhoneTouched: vi.fn(),
  setActiveNumericField: vi.fn(),
  setKioskInfoPhase: vi.fn(),
  setAddons: vi.fn(),
  requestAccountPreparation: vi.fn(async () => preparedAccount()),
  requestNewStudentOutcome: vi.fn(async () => ({ outcome: "eligible" }) as never),
  showRegularFallbackPopup: vi.fn(),
  handleSubmit: vi.fn(async () => {}),
  ...override,
})

describe("useEnrollNavigationActions", () => {
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

  const renderHook = async (input: UseEnrollNavigationActionsInput) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextInput: UseEnrollNavigationActionsInput) {
      result = useEnrollNavigationActions(nextInput)
      return null
    }

    await act(async () => root!.render(<Harness {...input} />))
    return {
      getResult: () => result!,
      rerender: async (nextInput: UseEnrollNavigationActionsInput) => {
        await act(async () => root!.render(<Harness {...nextInput} />))
      },
    }
  }

  describe("numpad handlers", () => {
    it("appends a digit to phone only when activeNumericField is 'phone'", async () => {
      const setContact = vi.fn()
      const setPhoneTouched = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ activeNumericField: "phone", setContact, setPhoneTouched })
      )
      act(() => getResult().handleNumpadDigit("5"))

      expect(setContact).toHaveBeenCalledTimes(1)
      const updater = setContact.mock.calls[0][0] as (c: EnrollmentContact) => EnrollmentContact
      expect(updater(defaultContact())).toEqual({ ...defaultContact(), phone: "+1 (5" })
      expect(setPhoneTouched).toHaveBeenCalledWith(true)
    })

    it("does nothing when activeNumericField is not 'phone'", async () => {
      const setContact = vi.fn()
      const setPhoneTouched = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ activeNumericField: null, setContact, setPhoneTouched })
      )
      act(() => getResult().handleNumpadDigit("5"))

      expect(setContact).not.toHaveBeenCalled()
      expect(setPhoneTouched).not.toHaveBeenCalled()
    })

    it("removes the last phone digit on backspace when field is active", async () => {
      const setContact = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ activeNumericField: "phone", contact: { ...defaultContact(), phone: "+1 555" }, setContact })
      )
      act(() => getResult().handleNumpadBackspace())

      expect(setContact).toHaveBeenCalledTimes(1)
      const updater = setContact.mock.calls[0][0] as (c: EnrollmentContact) => EnrollmentContact
      expect(updater({ ...defaultContact(), phone: "+1 555" }).phone).toBe("+1 (55")
    })

    it("does nothing on backspace when field is not active", async () => {
      const setContact = vi.fn()
      const { getResult } = await renderHook(defaultInput({ activeNumericField: null, setContact }))
      act(() => getResult().handleNumpadBackspace())
      expect(setContact).not.toHaveBeenCalled()
    })

    it("resets phone to '+1 ' on clear when field is active", async () => {
      const setContact = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ activeNumericField: "phone", setContact })
      )
      act(() => getResult().handleNumpadClear())

      expect(setContact).toHaveBeenCalledTimes(1)
      const updater = setContact.mock.calls[0][0] as (c: EnrollmentContact) => EnrollmentContact
      expect(updater({ ...defaultContact(), phone: "+1 5551234567" }).phone).toBe("+1 ")
    })

    it("does nothing on clear when field is not active", async () => {
      const setContact = vi.fn()
      const { getResult } = await renderHook(defaultInput({ activeNumericField: null, setContact }))
      act(() => getResult().handleNumpadClear())
      expect(setContact).not.toHaveBeenCalled()
    })
  })

  describe("advanceFromContactStep — non check-in flow", () => {
    it("simply advances step by 1 when not a check-in flow", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isCheckInFlow: false, step: 0, setStep }))
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })
  })

  describe("advanceFromContactStep — kiosk/QR new-student SMS verification", () => {
    it("kiosk: calls verifyNewStudent and stops (no step change) on sms_pending", async () => {
      const verifyNewStudent = vi.fn(async () => "sms_pending")
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const setStep = vi.fn()
      const setIdentityCheckBusy = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isKioskTerminalFlow: true,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123", email: "a@b.com" },
          verifyNewStudent,
          requestAccountPreparation,
          setStep,
          setIdentityCheckBusy,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(verifyNewStudent).toHaveBeenCalledWith("+1 5555550123", "a@b.com")
      expect(requestAccountPreparation).toHaveBeenCalledTimes(1)
      expect(setStep).not.toHaveBeenCalled()
      expect(setIdentityCheckBusy).toHaveBeenNthCalledWith(1, true)
      expect(setIdentityCheckBusy).toHaveBeenNthCalledWith(2, false)
    })

    it("kiosk: existing user detected short-circuits via onExistingUserDetected and does not prepare account", async () => {
      const verifyNewStudent = vi.fn(async () => "existing_detected")
      const onExistingUserDetected = vi.fn()
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isKioskTerminalFlow: true,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123" },
          verifyNewStudent,
          onExistingUserDetected,
          requestAccountPreparation,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(onExistingUserDetected).toHaveBeenCalledTimes(1)
      expect(requestAccountPreparation).not.toHaveBeenCalled()
    })

    it("QR mobile compact: takes the same SMS-verify branch as kiosk", async () => {
      const verifyNewStudent = vi.fn(async () => "sms_pending")
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isQrMobileCompactFlow: true,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123" },
          verifyNewStudent,
          requestAccountPreparation,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(verifyNewStudent).toHaveBeenCalled()
    })

    it("does not call verifyNewStudent when phone is incomplete", async () => {
      const verifyNewStudent = vi.fn(async () => "sms_pending")
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isKioskTerminalFlow: true,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 555" },
          verifyNewStudent,
          requestAccountPreparation,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(verifyNewStudent).not.toHaveBeenCalled()
      // Falls through to account preparation directly.
      expect(requestAccountPreparation).toHaveBeenCalledTimes(1)
    })
  })

  describe("advanceFromContactStep — web new-student flow", () => {
    it("falls back to regular pricing when outcome is fallback_regular", async () => {
      const requestNewStudentOutcome = vi.fn(async () => ({ outcome: "fallback_regular", message: "hi" }) as never)
      const showRegularFallbackPopup = vi.fn()
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isKioskTerminalFlow: false,
          isQrMobileCompactFlow: false,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123" },
          requestNewStudentOutcome,
          showRegularFallbackPopup,
          requestAccountPreparation,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(showRegularFallbackPopup).toHaveBeenCalledWith("hi")
      expect(requestAccountPreparation).not.toHaveBeenCalled()
    })

    it("requires SMS verification: prepares account then opens sign-in when not signed in", async () => {
      const requestNewStudentOutcome = vi.fn(async () => ({ outcome: "requires_sms_verification" }) as never)
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const setRequiresSignIn = vi.fn()
      const setSignInPurpose = vi.fn()
      const setResumeContactFlowAfterSignIn = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isKioskTerminalFlow: false,
          isQrMobileCompactFlow: false,
          isSignedIn: false,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123" },
          requestNewStudentOutcome,
          requestAccountPreparation,
          setRequiresSignIn,
          setSignInPurpose,
          setResumeContactFlowAfterSignIn,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(setSignInPurpose).toHaveBeenCalledWith("sms_verification")
      expect(setRequiresSignIn).toHaveBeenCalledWith(true)
      expect(setResumeContactFlowAfterSignIn).toHaveBeenCalledWith(true)
      // Only the first outcome call was made — did not re-verify since it stopped for sign-in.
      expect(requestNewStudentOutcome).toHaveBeenCalledTimes(1)
    })

    it("requires SMS verification, already signed in and not requiresSignIn: re-verifies and proceeds if eligible", async () => {
      const requestNewStudentOutcome = vi
        .fn()
        .mockResolvedValueOnce({ outcome: "requires_sms_verification" })
        .mockResolvedValueOnce({ outcome: "eligible", eligibleForNewStudent: true })
      const requestAccountPreparation = vi.fn(async () => preparedAccount({ requiresSignIn: false }))
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isSignedIn: true,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123" },
          requestNewStudentOutcome,
          requestAccountPreparation,
          packagesStepIndex: 1,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(requestNewStudentOutcome).toHaveBeenCalledTimes(2)
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("requires SMS verification, re-verify fails eligibility: falls back to regular", async () => {
      const requestNewStudentOutcome = vi
        .fn()
        .mockResolvedValueOnce({ outcome: "requires_sms_verification" })
        .mockResolvedValueOnce({ outcome: "fallback_regular", message: "nope" })
      const requestAccountPreparation = vi.fn(async () => preparedAccount({ requiresSignIn: false }))
      const showRegularFallbackPopup = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isSignedIn: true,
          service: "new-student",
          contact: { ...defaultContact(), phone: "+1 5555550123" },
          requestNewStudentOutcome,
          requestAccountPreparation,
          showRegularFallbackPopup,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(showRegularFallbackPopup).toHaveBeenCalledWith("nope")
    })
  })

  describe("advanceFromContactStep — account preparation / sign-in gate", () => {
    it("opens sign-in when photo requires customer_self upload, account.requiresSignIn, not signed in, not QR mobile", async () => {
      const requestAccountPreparation = vi.fn(async () => preparedAccount({ requiresSignIn: true }))
      const setRequiresSignIn = vi.fn()
      const setSignInPurpose = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isSignedIn: false,
          isQrMobileCompactFlow: false,
          photoPolicy: requiredSelfPhotoPolicy(),
          requestAccountPreparation,
          setRequiresSignIn,
          setSignInPurpose,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(setSignInPurpose).toHaveBeenCalledWith("account_preparation")
      expect(setRequiresSignIn).toHaveBeenCalledWith(true)
    })

    it("skips the sign-in gate for QR mobile compact flow even when account.requiresSignIn", async () => {
      const requestAccountPreparation = vi.fn(async () => preparedAccount({ requiresSignIn: true }))
      const setRequiresSignIn = vi.fn()
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isSignedIn: false,
          isQrMobileCompactFlow: true,
          photoPolicy: requiredSelfPhotoPolicy(),
          photoStepIndex: 1,
          requestAccountPreparation,
          setRequiresSignIn,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })

      expect(setRequiresSignIn).not.toHaveBeenCalled()
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("uses the already-prepared account instead of calling requestAccountPreparation again", async () => {
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          preparedAccount: preparedAccount({ hasAvatar: true }),
          requestAccountPreparation,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(requestAccountPreparation).not.toHaveBeenCalled()
    })

    it("stops (no further step change) when account preparation fails", async () => {
      const requestAccountPreparation = vi.fn(async () => null)
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ isCheckInFlow: true, requestAccountPreparation, setStep })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).not.toHaveBeenCalled()
    })
  })

  describe("advanceFromContactStep — post-account-prep step routing", () => {
    it("routes to photoStepIndex when photo is required and not yet saved", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          photoPolicy: requiredSelfPhotoPolicy(),
          photoSaved: false,
          photoStepIndex: 1,
          promoStepIndex: -1,
          packagesStepIndex: 2,
          paymentsStepIndex: 3,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("routes to promoStepIndex when it exists and photo/packages do not apply (kiosk new-student 3-step flow)", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          photoStepIndex: -1,
          promoStepIndex: 1,
          packagesStepIndex: -1,
          paymentsStepIndex: 2,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("prefers promoStepIndex over packagesStepIndex when both exist", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          photoStepIndex: -1,
          promoStepIndex: 1,
          packagesStepIndex: 2,
          paymentsStepIndex: 3,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("routes to packagesStepIndex when photo and promo steps are not applicable", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          photoStepIndex: -1,
          promoStepIndex: -1,
          packagesStepIndex: 1,
          paymentsStepIndex: 2,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("routes to paymentsStepIndex when neither photo, promo nor packages steps exist", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          photoStepIndex: -1,
          promoStepIndex: -1,
          packagesStepIndex: -1,
          paymentsStepIndex: 2,
          setStep,
        })
      )
      await act(async () => {
        await getResult().advanceFromContactStep()
      })
      expect(setStep).toHaveBeenCalledWith(2)
    })
  })

  describe("handleFormStepSubmit — phased kiosk info form", () => {
    it("advances the phase (does not change step) while phase transitions are pending", async () => {
      const setKioskInfoPhase = vi.fn()
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          usesPhasedInfoForm: true,
          activeStepKey: "info",
          kioskInfoPhase: "name-email",
          isKioskTerminalFlow: false,
          setKioskInfoPhase,
          setStep,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      expect(setKioskInfoPhase).toHaveBeenCalledWith("phone")
      expect(setStep).not.toHaveBeenCalled()
    })

    it("kiosk terminal is phone-first: phase 'phone' advances to 'name-email' and clears the numpad field", async () => {
      const setKioskInfoPhase = vi.fn()
      const setActiveNumericField = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          usesPhasedInfoForm: true,
          activeStepKey: "info",
          kioskInfoPhase: "phone",
          isKioskTerminalFlow: true,
          setKioskInfoPhase,
          setActiveNumericField,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      expect(setKioskInfoPhase).toHaveBeenCalledWith("name-email")
      expect(setActiveNumericField).toHaveBeenCalledWith(null)
    })

    it("kiosk terminal phase 'name-email' (already past phone-first phase) is 'done': proceeds without re-arming the numpad", async () => {
      const setKioskInfoPhase = vi.fn()
      const setActiveNumericField = vi.fn()
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          usesPhasedInfoForm: true,
          activeStepKey: "info",
          kioskInfoPhase: "name-email",
          isKioskTerminalFlow: true,
          isCheckInFlow: false,
          step: 0,
          setKioskInfoPhase,
          setActiveNumericField,
          setStep,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      expect(setKioskInfoPhase).not.toHaveBeenCalled()
      expect(setActiveNumericField).not.toHaveBeenCalled()
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("once the phased info form phase is done, proceeds to normal step advancement", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          usesPhasedInfoForm: true,
          activeStepKey: "info",
          kioskInfoPhase: "phone",
          isCheckInFlow: false,
          step: 0,
          setStep,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })
  })

  describe("handleFormStepSubmit — non-phased flows", () => {
    it("delegates to advanceFromContactStep when on the check-in contact gate step", async () => {
      const setStep = vi.fn()
      const setIdentityCheckBusy = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          activeStepKey: "info",
          step: 0,
          setStep,
          setIdentityCheckBusy,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      // advanceFromContactStep ran (identity check busy toggled true then false).
      expect(setIdentityCheckBusy).toHaveBeenNthCalledWith(1, true)
      expect(setIdentityCheckBusy).toHaveBeenNthCalledWith(2, false)
    })

    it("advances step by 1 for a normal (non-contact-gate) step", async () => {
      const setStep = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: false,
          activeStepKey: "packages",
          step: 1,
          setStep,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      expect(setStep).toHaveBeenCalledWith(2)
    })

    it("calls handleSubmit when on the last step", async () => {
      const handleSubmit = vi.fn(async () => {})
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: false,
          activeStepKey: "payments",
          step: 2,
          steps: [
            { key: "info", label: "Info" },
            { key: "packages", label: "Packages" },
            { key: "payments", label: "Payments" },
          ],
          handleSubmit,
        })
      )
      await act(async () => {
        await getResult().handleFormStepSubmit()
      })
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })
  })

  describe("toggleAddon", () => {
    it("adds an addon id when not already present", async () => {
      const setAddons = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setAddons }))
      act(() => getResult().toggleAddon("shoes"))

      const updater = setAddons.mock.calls[0][0] as (prev: string[]) => string[]
      expect(updater([])).toEqual(["shoes"])
    })

    it("removes an addon id when already present", async () => {
      const setAddons = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setAddons }))
      act(() => getResult().toggleAddon("shoes"))

      const updater = setAddons.mock.calls[0][0] as (prev: string[]) => string[]
      expect(updater(["shoes", "belt"])).toEqual(["belt"])
    })
  })

  describe("formatPackageMeta", () => {
    it("joins cadence, totalClasses and makeUps with a bullet separator", async () => {
      const { getResult } = await renderHook(defaultInput())
      const label = getResult().formatPackageMeta({
        meta: { cadence: "Weekly", totalClasses: 8, makeUps: 2 },
        description: "fallback",
      })
      expect(label).toBe("Weekly • 8 classes • +2 make-ups")
    })

    it("falls back to description when there is no meta", async () => {
      const { getResult } = await renderHook(defaultInput())
      const label = getResult().formatPackageMeta({ description: "fallback" })
      expect(label).toBe("fallback")
    })

    it("returns undefined when option itself is null", async () => {
      const { getResult } = await renderHook(defaultInput())
      const label = getResult().formatPackageMeta(null)
      expect(label).toBeUndefined()
    })
  })
})
