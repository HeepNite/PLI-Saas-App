import { describe, expect, it, vi } from "vitest"
import {
  computeCheckInAutofill,
  formatCheckInSummaryDateTime,
} from "@/components/front/courses/enroll/model/checkin-autofill"
import { resolveStationTimeoutAction, shouldNotifyPaymentsStepReady } from "@/lib/checkin/enroll-flow"
import { isKioskInfoFastPathEligible, shouldAutoAdvanceKioskInfoStep, shouldMaskKioskInfoStep } from "@/lib/checkin/kiosk-qr-payment"
import { getPhotoPolicy, isPhotoRequiredForAccount } from "@/lib/checkin/photo-context-policy"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"
import { resolveCheckInServiceSelection } from "@/lib/checkin/new-student-flow"
import { pickEnrollPrefill } from "@/lib/checkin/package-offer-integration"
import type { CourseData } from "@/constants/courses"

const testCourses: CourseData[] = [
  {
    slug: "salsa-timba-in-new-york",
    title: "Salsa timba in New York",
    description: "",
    level: "Beginner",
    duration: "60 min",
    schedule: {
      day: "Wednesday",
      time: "22:00",
      starts: "2026-01-01",
      availableWeekdays: [2],
      availableTimes: ["22:00"],
    },
    location: { address: "Palladium" },
    instructors: [],
    enrollment: {
      services: [{ id: "drop-in", label: "Drop-in", price: 29 }],
      packages: [],
    },
  },
]

describe("phase 1 guardrails", () => {
  it("keeps existing summary format behavior", () => {
    expect(formatCheckInSummaryDateTime("2026-03-20", "20:10")).toBe("Friday, March 20 · 8:10 PM")
  })

  it("keeps kiosk check-in context date/time authoritative", () => {
    const result = computeCheckInAutofill(
      "salsa-timba-in-new-york",
      testCourses,
      { date: "2026-05-06", time: "22:00" },
      new Date("2026-05-06T23:10:00-04:00")
    )

    expect(result).toMatchObject({ date: "2026-05-06", time: "22:00" })
  })

  it("notifies payments-step readiness from info in kiosk fast-path", () => {
    expect(
      shouldNotifyPaymentsStepReady({
        open: true,
        hasFired: false,
        activeStepKey: "info",
        showKioskPaymentTransition: true,
      })
    ).toBe(true)
  })

  it("blocks payments-step readiness until transition overlay clears", () => {
    expect(
      shouldNotifyPaymentsStepReady({
        open: true,
        hasFired: false,
        activeStepKey: "payments",
        showKioskPaymentTransition: true,
      })
    ).toBe(false)

    expect(
      shouldNotifyPaymentsStepReady({
        open: true,
        hasFired: false,
        activeStepKey: "payments",
        showKioskPaymentTransition: false,
      })
    ).toBe(true)
  })

  it("prefers onTimeoutAction over onCompletedAction for station inactivity", () => {
    const onCompleted = vi.fn()
    const onTimeout = vi.fn()
    expect(resolveStationTimeoutAction(onTimeout, onCompleted)).toBe(onTimeout)
    expect(resolveStationTimeoutAction(undefined, onCompleted)).toBe(onCompleted)
  })

  it("keeps kiosk info fast-path eligibility contract", () => {
    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-05-06",
        time: "22:00",
        contact: { firstName: "Ana", lastName: "Diaz", email: "ana@example.com", phone: "+1 917 555 1212" },
      })
    ).toBe(true)
  })

  it("auto-advance guard stays blocked while processing", () => {
    expect(
      shouldAutoAdvanceKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-05-06",
        time: "22:00",
        contact: { firstName: "Ana", lastName: "Diaz", email: "ana@example.com", phone: "+1 917 555 1212" },
        activeStepKey: "info",
        open: true,
        processing: true,
        identityCheckBusy: false,
        requiresSignIn: false,
        hasError: false,
      })
    ).toBe(false)
  })

  it("masks kiosk info content only while hydrating/transitioning", () => {
    expect(
      shouldMaskKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "info",
        open: true,
        requiresSignIn: false,
        hasError: false,
        hydrating: true,
        transitionPending: false,
      })
    ).toBe(true)
  })

  it("keeps photo requirement contract by context", () => {
    const terminalPolicy = getPhotoPolicy("kiosk_terminal")
    expect(isPhotoRequiredForAccount(terminalPolicy, false)).toBe(true)

    const webPolicy = getPhotoPolicy("external_web")
    expect(isPhotoRequiredForAccount(webPolicy, false)).toBe(false)
  })

  it("keeps new-student service selection fallback contract", () => {
    expect(
      resolveCheckInServiceSelection({
        previousService: "drop-in",
        availableServiceIds: ["drop-in", "new-student"],
        isCheckInNewFlow: true,
        hasNewStudentService: true,
        regularFallbackLocked: false,
      })
    ).toBe("new-student")
  })

  it("keeps package-offer prefill priority over quick checkout package", () => {
    const prefill = pickEnrollPrefill({
      quickCheckout: {
        serviceId: "dropin",
        packageId: "quick-package",
        addons: [],
        participants: 1,
        coupon: "",
        amountCents: 2000,
        currency: "usd",
        sourcePurchaseId: null,
        sourcePurchaseAt: null,
      },
      selectedPackageId: "offer-package",
    })

    expect(prefill?.packageId).toBe("offer-package")
  })

  it("arms and re-arms inactivity timeout controller", () => {
    const scheduled: Array<() => void> = []
    const cancelled: unknown[] = []
    const onTimeout = vi.fn()

    const controller = createKioskInactivityController({
      onTimeout,
      schedule: ((cb: () => void) => {
        scheduled.push(cb)
        return scheduled.length as unknown as ReturnType<typeof setTimeout>
      }) as typeof setTimeout,
      cancel: ((id: unknown) => {
        cancelled.push(id)
      }) as typeof clearTimeout,
    })

    controller.arm()
    controller.arm()
    expect(cancelled.length).toBe(1)

    scheduled[1]()
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
