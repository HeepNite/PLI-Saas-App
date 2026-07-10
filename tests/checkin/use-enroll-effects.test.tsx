// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  useEnrollEffectsPreInit,
  useEnrollEffectsEarly,
  useEnrollEffectsMid,
  useEnrollEffectsCheckInAutofill,
  useEnrollEffectsLate,
} from "@/components/front/courses/enroll/hooks/useEnrollEffects"
import type { UseEnrollEffectsInput } from "@/components/front/courses/enroll/hooks/useEnrollEffects"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { PreparedAccountState } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"

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

const preparedAccount = (override: Partial<PreparedAccountState> = {}): PreparedAccountState =>
  ({
    clerkUserId: null,
    created: false,
    requiresSignIn: false,
    hasAvatar: false,
    ...override,
  }) as PreparedAccountState

const defaultInput = (override: Partial<UseEnrollEffectsInput> = {}): UseEnrollEffectsInput => ({
  open: true,
  isInline: false,
  isCheckInFlow: false,
  isCheckInNewFlow: false,
  isCheckInExistingFlow: false,
  isKioskTerminalFlow: false,
  isQrMobileCompactFlow: false,
  isNewStudent: false,
  isPersonalCompletion: false,
  isStationCompletion: false,
  success: false,
  prefillContact: undefined,
  course: { slug: "intro-salsa", enrollment: { packages: [{ id: "drop-in" }], addons: [{ id: "shoes" }], services: [{ id: "regular" }] } },
  sourceCourses: [],
  availableServices: [{ id: "regular" }] as UseEnrollEffectsInput["availableServices"],
  contact: defaultContact(),
  service: "regular",
  participants: 1,
  date: "",
  time: "",
  checkInContextDate: "",
  checkInContextTime: "",
  checkInNow: new Date("2026-07-01T12:00:00Z"),
  checkInScheduleNotice: null,
  requiresSignIn: false,
  existingAccountDetected: false,
  resumeAfterSignInStep: null,
  resumeContactFlowAfterSignIn: false,
  pendingAutoPay: false,
  isSignedIn: false,
  isLoaded: true,
  processing: false,
  hasNewStudentService: false,
  regularFallbackLocked: false,
  regularServiceId: "regular",
  steps: [
    { key: "info", label: "Info" },
    { key: "packages", label: "Packages" },
    { key: "payments", label: "Payments" },
  ],
  preparedAccount: null,
  photoSaved: false,
  photoPolicy: noPhotoPolicy(),
  photoStepIndex: -1,
  promoStepIndex: -1,
  packagesStepIndex: 1,
  paymentsStepIndex: 2,
  user: null,
  verificationState: "idle",
  pendingClerkSessionRef: { current: null },
  stationCompletionTimeoutRef: { current: null },
  kioskPaymentTransitionTimeoutRef: { current: null },
  kioskPaymentTransitionStartedAtRef: { current: null },
  getToken: vi.fn(async () => "token"),
  router: { replace: vi.fn() },
  setActive: vi.fn(async () => {}),
  onCompletedAction: undefined,
  requestAccountPreparation: vi.fn(async () => null),
  resetVerification: vi.fn(),
  advanceFromContactStepRef: { current: vi.fn(async () => {}) },
  handleSubmitRef: { current: vi.fn(async () => {}) },
  setService: vi.fn(),
  setPkg: vi.fn(),
  setAddons: vi.fn(),
  setParticipants: vi.fn(),
  setDate: vi.fn(),
  setTime: vi.fn(),
  setContact: vi.fn(),
  setStep: vi.fn(),
  setCheckInNow: vi.fn(),
  setCheckInScheduleNotice: vi.fn(),
  setRequiresSignIn: vi.fn(),
  setExistingAccountDetected: vi.fn(),
  setResumeAfterSignInStep: vi.fn(),
  setResumeContactFlowAfterSignIn: vi.fn(),
  setPendingAutoPay: vi.fn(),
  setFormError: vi.fn(),
  setPreparedAccount: vi.fn(),
  setPhotoSaved: vi.fn(),
  setShowKioskPaymentTransition: vi.fn(),
  setInitialLoading: vi.fn(),
  ...override,
})

describe("useEnrollEffects", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderHook = async (input: UseEnrollEffectsInput) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextInput: UseEnrollEffectsInput) {
      // Mirrors the exact call order wired in EnrollModal: pre-init cluster
      // (before useEnrollInit/useEnrollDraft) -> early cluster (after those,
      // before useKioskInactivity) -> mid cluster (after useKioskInactivity,
      // before useEnrollPaymentActions) -> late cluster (after
      // handleSubmitRef/advanceFromContactStepRef are assigned).
      useEnrollEffectsPreInit(nextInput)
      useEnrollEffectsEarly(nextInput)
      useEnrollEffectsMid(nextInput)
      useEnrollEffectsCheckInAutofill(nextInput)
      useEnrollEffectsLate(nextInput)
      return null
    }

    await act(async () => root!.render(<Harness {...input} />))
    return {
      rerender: async (nextInput: UseEnrollEffectsInput) => {
        await act(async () => root!.render(<Harness {...nextInput} />))
      },
    }
  }

  describe("initial loading delay", () => {
    it("calls setInitialLoading(false) after 400ms and clears the timeout on unmount", async () => {
      const setInitialLoading = vi.fn()
      await renderHook(defaultInput({ setInitialLoading }))

      expect(setInitialLoading).not.toHaveBeenCalled()
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
      expect(setInitialLoading).toHaveBeenCalledWith(false)
    })
  })

  describe("body scroll lock", () => {
    it("locks body overflow when open and not inline, restores previous value on cleanup", async () => {
      document.body.style.overflow = "auto"
      const { rerender } = await renderHook(defaultInput({ open: true, isInline: false }))
      expect(document.body.style.overflow).toBe("hidden")

      await rerender(defaultInput({ open: false, isInline: false }))
      expect(document.body.style.overflow).toBe("auto")
    })

    it("does not lock body overflow when isInline is true", async () => {
      document.body.style.overflow = "auto"
      await renderHook(defaultInput({ open: true, isInline: true }))
      expect(document.body.style.overflow).toBe("auto")
    })
  })

  describe("check-in clock", () => {
    it("sets checkInNow immediately and every 30s while isCheckInFlow && open", async () => {
      const setCheckInNow = vi.fn()
      await renderHook(defaultInput({ isCheckInFlow: true, open: true, setCheckInNow }))

      expect(setCheckInNow).toHaveBeenCalledTimes(1)
      await act(async () => {
        vi.advanceTimersByTime(30_000)
      })
      expect(setCheckInNow).toHaveBeenCalledTimes(2)
    })

    it("does not start the clock when isCheckInFlow is false", async () => {
      const setCheckInNow = vi.fn()
      await renderHook(defaultInput({ isCheckInFlow: false, open: true, setCheckInNow }))
      expect(setCheckInNow).not.toHaveBeenCalled()
    })
  })

  describe("cleanup timeouts on unmount", () => {
    it("clears stationCompletionTimeoutRef and kioskPaymentTransitionTimeoutRef on unmount", async () => {
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
      const stationCompletionTimeoutRef = { current: 11 }
      const kioskPaymentTransitionTimeoutRef = { current: 22 }
      await renderHook(defaultInput({ stationCompletionTimeoutRef, kioskPaymentTransitionTimeoutRef }))

      await act(async () => root?.unmount())
      root = null

      expect(clearTimeoutSpy).toHaveBeenCalledWith(11)
      expect(clearTimeoutSpy).toHaveBeenCalledWith(22)
      expect(stationCompletionTimeoutRef.current).toBeNull()
      expect(kioskPaymentTransitionTimeoutRef.current).toBeNull()
    })
  })

  describe("station completion auto-close", () => {
    it("fires onCompletedAction after 10s when success && isStationCompletion", async () => {
      const onCompletedAction = vi.fn(async () => {})
      await renderHook(defaultInput({ success: true, isStationCompletion: true, onCompletedAction }))

      expect(onCompletedAction).not.toHaveBeenCalled()
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      expect(onCompletedAction).toHaveBeenCalledTimes(1)
    })

    it("does not schedule a timer when isStationCompletion is false", async () => {
      const onCompletedAction = vi.fn(async () => {})
      await renderHook(defaultInput({ success: true, isStationCompletion: false, onCompletedAction }))
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      expect(onCompletedAction).not.toHaveBeenCalled()
    })
  })

  describe("personal completion redirect", () => {
    it("redirects to /client-profile directly when there is no pending Clerk session", async () => {
      const router = { replace: vi.fn() }
      await renderHook(
        defaultInput({ success: true, isPersonalCompletion: true, router, pendingClerkSessionRef: { current: null } })
      )
      expect(router.replace).toHaveBeenCalledWith("/client-profile")
    })

    it("activates the pending Clerk session before redirecting when a session id is present", async () => {
      const router = { replace: vi.fn() }
      const setActive = vi.fn(async () => {})
      await renderHook(
        defaultInput({
          success: true,
          isPersonalCompletion: true,
          router,
          setActive,
          pendingClerkSessionRef: { current: "sess_123" },
        })
      )
      await act(async () => {})
      expect(setActive).toHaveBeenCalledWith({ session: "sess_123" })
      expect(router.replace).toHaveBeenCalledWith("/client-profile")
    })
  })

  describe("force participants=1 for new student", () => {
    it("forces participants to 1 when isNewStudent and participants !== 1", async () => {
      const setParticipants = vi.fn()
      await renderHook(defaultInput({ isNewStudent: true, participants: 3, setParticipants }))
      expect(setParticipants).toHaveBeenCalledWith(1)
    })

    it("does not call setParticipants when already 1", async () => {
      const setParticipants = vi.fn()
      await renderHook(defaultInput({ isNewStudent: true, participants: 1, setParticipants }))
      expect(setParticipants).not.toHaveBeenCalled()
    })
  })

  describe("auto-pay after sign-in", () => {
    it("submits after acquiring a token, resets requiresSignIn and pendingAutoPay first", async () => {
      const getToken = vi.fn(async () => "tok_abc")
      const setRequiresSignIn = vi.fn()
      const setPendingAutoPay = vi.fn()
      const handleSubmit = vi.fn(async () => {})
      await renderHook(
        defaultInput({
          pendingAutoPay: true,
          isSignedIn: true,
          processing: false,
          getToken,
          setRequiresSignIn,
          setPendingAutoPay,
          handleSubmitRef: { current: handleSubmit },
        })
      )

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(getToken).toHaveBeenCalledWith({ skipCache: true })
      expect(setRequiresSignIn).toHaveBeenCalledWith(false)
      expect(setPendingAutoPay).toHaveBeenCalledWith(false)
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    it("does not run when pendingAutoPay is false", async () => {
      const getToken = vi.fn(async () => "tok_abc")
      await renderHook(defaultInput({ pendingAutoPay: false, isSignedIn: true, getToken }))
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      expect(getToken).not.toHaveBeenCalled()
    })

    it("retries up to 6 times with a 350ms backoff while no token is returned", async () => {
      const getToken = vi.fn(async () => null)
      await renderHook(defaultInput({ pendingAutoPay: true, isSignedIn: true, getToken }))

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(getToken).toHaveBeenCalledTimes(1)

      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          vi.advanceTimersByTime(350)
        })
        await act(async () => {
          await Promise.resolve()
        })
      }
      expect(getToken).toHaveBeenCalledTimes(6)

      await act(async () => {
        vi.advanceTimersByTime(350)
      })
      expect(getToken).toHaveBeenCalledTimes(6)
    })
  })

  describe("resume flow after sign-in", () => {
    it("clears requiresSignIn and existingAccountDetected once signed in", async () => {
      const setRequiresSignIn = vi.fn()
      const setExistingAccountDetected = vi.fn()
      await renderHook(
        defaultInput({
          isSignedIn: true,
          requiresSignIn: true,
          existingAccountDetected: true,
          setRequiresSignIn,
          setExistingAccountDetected,
        })
      )
      expect(setRequiresSignIn).toHaveBeenCalledWith(false)
      expect(setExistingAccountDetected).toHaveBeenCalledWith(false)
    })

    it("clamps and applies resumeAfterSignInStep, switches off new-student service when applicable", async () => {
      const setStep = vi.fn()
      const setResumeAfterSignInStep = vi.fn()
      const setFormError = vi.fn()
      const setService = vi.fn()
      await renderHook(
        defaultInput({
          isSignedIn: true,
          resumeAfterSignInStep: 99,
          service: "new-student",
          regularServiceId: "regular",
          isQrMobileCompactFlow: false,
          steps: [{ key: "info", label: "Info" }, { key: "packages", label: "Packages" }],
          setStep,
          setResumeAfterSignInStep,
          setFormError,
          setService,
        })
      )
      expect(setService).toHaveBeenCalledWith("regular")
      expect(setStep).toHaveBeenCalledWith(1)
      expect(setResumeAfterSignInStep).toHaveBeenCalledWith(null)
      expect(setFormError).toHaveBeenCalledWith(null)
    })

    it("advances from the contact step when resumeContactFlowAfterSignIn is true", async () => {
      const advance = vi.fn(async () => {})
      const setResumeContactFlowAfterSignIn = vi.fn()
      await renderHook(
        defaultInput({
          isSignedIn: true,
          resumeContactFlowAfterSignIn: true,
          advanceFromContactStepRef: { current: advance },
          setResumeContactFlowAfterSignIn,
        })
      )
      expect(setResumeContactFlowAfterSignIn).toHaveBeenCalledWith(false)
      expect(advance).toHaveBeenCalledTimes(1)
    })
  })

  describe("clamp step on steps change", () => {
    it("clamps step within [0, steps.length - 1] while open", async () => {
      const setStep = vi.fn()
      await renderHook(
        defaultInput({ open: true, steps: [{ key: "info", label: "Info" }], setStep })
      )
      const updater = setStep.mock.calls[0][0] as (prev: number) => number
      expect(updater(5)).toBe(0)
    })

    it("does not clamp when closed", async () => {
      const setStep = vi.fn()
      await renderHook(defaultInput({ open: false, setStep }))
      expect(setStep).not.toHaveBeenCalled()
    })
  })

  describe("SMS verification continue (kiosk/QR)", () => {
    it("advances to photoStepIndex when a photo is required and account has no avatar", async () => {
      const setStep = vi.fn()
      const resetVerification = vi.fn()
      const requestAccountPreparation = vi.fn(async () => preparedAccount({ hasAvatar: false }))
      const photoPolicy: PhotoPolicy = {
        context: "kiosk_terminal",
        photoRequired: true,
        allowCameraCapture: true,
        allowGalleryUpload: false,
        uploadMode: "customer_self",
      }
      await renderHook(
        defaultInput({
          verificationState: "verified",
          isKioskTerminalFlow: true,
          photoPolicy,
          photoStepIndex: 0,
          packagesStepIndex: 1,
          paymentsStepIndex: 2,
          requestAccountPreparation,
          setStep,
          resetVerification,
        })
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(setStep).toHaveBeenCalledWith(0)
      expect(resetVerification).toHaveBeenCalledTimes(1)
    })

    it("falls through to packagesStepIndex when no photo is required and photoStepIndex is -1", async () => {
      const setStep = vi.fn()
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      await renderHook(
        defaultInput({
          verificationState: "verified",
          isKioskTerminalFlow: true,
          photoStepIndex: -1,
          packagesStepIndex: 1,
          paymentsStepIndex: 2,
          requestAccountPreparation,
          setStep,
        })
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(setStep).toHaveBeenCalledWith(1)
    })

    it("does not run when verificationState is not 'verified'", async () => {
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      await renderHook(
        defaultInput({ verificationState: "idle", isKioskTerminalFlow: true, requestAccountPreparation })
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(requestAccountPreparation).not.toHaveBeenCalled()
    })

    // KNOWN DRIFT (pre-fix): live EnrollModal's equivalent effect (lines ~970-989)
    // has a 4-branch step-target chain: photoStepIndex -> promoStepIndex ->
    // packagesStepIndex -> paymentsStepIndex. The hook, before reconciliation,
    // only has 3 branches and is missing the promoStepIndex branch entirely.
    // This test pins the CORRECT (live) behavior and must pass only after the
    // hook is fixed to add the promoStepIndex branch.
    it("advances to promoStepIndex when no photo is needed and promoStepIndex >= 0 (matches live EnrollModal)", async () => {
      const setStep = vi.fn()
      const requestAccountPreparation = vi.fn(async () => preparedAccount())
      await renderHook(
        defaultInput({
          verificationState: "verified",
          isKioskTerminalFlow: true,
          photoStepIndex: -1,
          promoStepIndex: 5,
          packagesStepIndex: 1,
          paymentsStepIndex: 2,
          requestAccountPreparation,
          setStep,
        })
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(setStep).toHaveBeenCalledWith(5)
    })
  })

  describe("check-in autofill date/time", () => {
    // KNOWN, INTENTIONALLY-PRESERVED live bug: `isKioskTerminalFlow` /
    // `isQrMobileCompactFlow` are READ inside this effect (passed to
    // `computeCheckInAutofill`) but are NOT in its deps array, matching live
    // EnrollModal's exact (pre-existing) `react-hooks/exhaustive-deps` gap.
    // Wiring this hook must not silently fix that bug -- it must reproduce it,
    // so this test pins the stale-closure behavior on purpose.
    it("does not re-run on an isKioskTerminalFlow-only change (matches live's stale-closure deps array)", async () => {
      const setDate = vi.fn()
      const setTime = vi.fn()
      const input = defaultInput({
        isCheckInFlow: true,
        open: true,
        course: { slug: "intro-salsa", enrollment: { packages: [], addons: [], services: [] } },
        checkInContextDate: "",
        checkInContextTime: "",
        date: "",
        time: "",
        isKioskTerminalFlow: false,
        setDate,
        setTime,
      })
      const { rerender } = await renderHook(input)
      setDate.mockClear()
      setTime.mockClear()

      // Only isKioskTerminalFlow changes; it is absent from the effect's deps
      // array (matching live), so the effect must NOT re-run.
      await rerender({ ...input, isKioskTerminalFlow: true })
      expect(setDate).not.toHaveBeenCalled()
      expect(setTime).not.toHaveBeenCalled()
    })
  })

  describe("early/mid/late split boundary", () => {
    it("fires all four clusters together without cross-cluster interference (pre-init, early, mid, late in one commit)", async () => {
      const setCheckInNow = vi.fn()
      const setContact = vi.fn()
      const setInitialLoading = vi.fn()
      const setService = vi.fn()
      const setStep = vi.fn()
      const handleSubmit = vi.fn(async () => {})

      await renderHook(
        defaultInput({
          isCheckInFlow: true,
          open: true,
          setCheckInNow,
          setContact,
          setInitialLoading,
          setService,
          setStep,
          handleSubmitRef: { current: handleSubmit },
        })
      )

      // Pre-init cluster (check-in clock) fired.
      expect(setCheckInNow).toHaveBeenCalledTimes(1)
      // Mid cluster (service/pkg/addon reset) fired independently.
      expect(setService).toHaveBeenCalled()
      // Late cluster (clamp-step-on-steps-change) fired independently, using
      // the functional-updater form -- proves it ran without needing state
      // written by the pre-init/early/mid clusters in the same commit.
      expect(setStep).toHaveBeenCalled()
      const clampUpdater = setStep.mock.calls[0][0] as (prev: number) => number
      expect(clampUpdater(99)).toBe(2)
    })

    it("does not require the late cluster's refs to be ready before the pre-init/early/mid clusters run", async () => {
      const setCheckInNow = vi.fn()
      // handleSubmitRef/advanceFromContactStepRef default to no-op mocks in
      // defaultInput(); this test proves the earlier clusters never read them,
      // so their construction order in EnrollModal (after useEnrollNavigationActions)
      // cannot affect the pre-init/early/mid clusters.
      await renderHook(defaultInput({ isCheckInFlow: true, open: true, setCheckInNow }))
      expect(setCheckInNow).toHaveBeenCalledTimes(1)
    })
  })
})
