// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"

import { useEnrollDerivedState } from "@/components/front/courses/enroll/hooks/useEnrollDerivedState"
import type { UseEnrollDerivedStateInput } from "@/components/front/courses/enroll/hooks/useEnrollDerivedState"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

type HookResult = ReturnType<typeof useEnrollDerivedState>

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const baseCourse = (): CourseEnrollmentData =>
  ({
    slug: "intro-salsa",
    title: "Intro Salsa",
    schedule: {
      day: "Monday",
      time: "18:00",
      starts: "2026-01-01",
      availableWeekdays: [0, 1, 2, 3, 4],
      availableTimes: ["18:00", "19:00"],
    },
    location: { address: "123 Main St" },
    instructors: [],
    enrollment: {
      services: [
        { id: "regular", label: "Regular", price: 20 },
        { id: "new-student", label: "New Student", price: 0 },
      ],
      packages: [{ id: "drop-in", label: "Drop In", price: 20 }],
      addons: [{ id: "shoes", label: "Shoes", price: 5 }],
    },
  }) as unknown as CourseEnrollmentData

const defaultContact = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "+1 ",
  note: "",
})

const defaultInput = (override: Partial<UseEnrollDerivedStateInput> = {}): UseEnrollDerivedStateInput => ({
  course: baseCourse(),
  sourceCourses: [],
  isCheckInFlow: false,
  isCheckInNewFlow: false,
  isCheckInExistingFlow: false,
  isKioskTerminalFlow: false,
  isQrMobileCompactFlow: false,
  isProfileBookingFlow: false,
  skipContactStep: false,
  initialStep: undefined,
  newStudentFallbackPhoneKey: null,
  contact: defaultContact(),
  service: "regular",
  pkg: "",
  addons: [],
  participants: 1,
  date: "",
  time: "",
  appliedCoupon: null,
  consecutiveAccepted: false,
  consecutiveAddedCents: 0,
  effectiveConsecutiveOffer: null,
  requiresPhotoStep: false,
  photoSaved: false,
  consecutiveChoiceMade: false,
  consecutiveOfferLoading: false,
  paymentMethod: "stripe",
  checkInNow: new Date("2026-06-26T18:10:00-04:00"),
  user: null,
  ...override,
})

describe("useEnrollDerivedState", () => {
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

  const renderHook = async (input: UseEnrollDerivedStateInput) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextInput: UseEnrollDerivedStateInput) {
      result = useEnrollDerivedState(nextInput)
      return null
    }

    await act(async () => root!.render(<Harness {...input} />))
    return {
      getResult: () => result!,
      rerender: async (nextInput: UseEnrollDerivedStateInput) => {
        await act(async () => root!.render(<Harness {...nextInput} />))
      },
    }
  }

  describe("kiosk new-student flow with packages", () => {
    it("produces info -> packages -> payments so a new student can buy a package", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isCheckInNewFlow: true,
          isKioskTerminalFlow: true,
        })
      )
      const r = getResult()

      expect(r.stepKeys).toEqual(["info", "packages", "payments"])
      expect(r.steps.map((s) => s.key)).toEqual(["info", "packages", "payments"])
      expect(r.steps.map((s) => s.label)).toEqual(["step_info", "Packages", "step_payments"])
      expect(r.packagesStepIndex).toBe(1)
      expect(r.infoStepIndex).toBe(0)
      expect(r.paymentsStepIndex).toBe(2)
      expect(r.promoStepIndex).toBe(-1)
      expect(r.photoStepIndex).toBe(-1)
    })
  })

  describe("kiosk existing check-in flow", () => {
    it("produces info -> packages -> payments steps with no promo step", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isCheckInExistingFlow: true,
          isKioskTerminalFlow: true,
          skipContactStep: true,
        })
      )
      const r = getResult()

      expect(r.stepKeys).toEqual(["info", "packages", "payments"])
      expect(r.promoStepIndex).toBe(-1)
      expect(r.packagesStepIndex).toBe(1)
      expect(r.paymentsStepIndex).toBe(2)
      // isCheckInExistingFlow filters out the new-student service.
      expect(r.availableServices.map((s) => s.id)).toEqual(["regular"])
      expect(r.hasNewStudentService).toBe(true)
    })

    it("includes the consecutive step and reports its label as Promo when an offer is present", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isCheckInExistingFlow: true,
          isKioskTerminalFlow: true,
          effectiveConsecutiveOffer: { id: "offer-1" },
        })
      )
      const r = getResult()

      expect(r.stepKeys).toEqual(["info", "packages", "consecutive", "payments"])
      const consecutiveStep = r.steps.find((s) => s.key === "consecutive")
      expect(consecutiveStep?.label).toBe("Promo")
    })
  })

  describe("QR-mobile-compact flow", () => {
    it("includes the photo step (non check-in) and computes visible weekday time slots", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isQrMobileCompactFlow: true,
          requiresPhotoStep: true,
          date: "2026-06-26", // Friday -> weekdayMon index 4, within [0..4]
        })
      )
      const r = getResult()

      expect(r.stepKeys).toEqual(["info", "photo", "packages", "payments"])
      expect(r.photoStepIndex).toBe(1)
      expect(r.packagesStepIndex).toBe(2)
      expect(r.paymentsStepIndex).toBe(3)
      expect(r.TIME_SLOTS_24).toEqual(["18:00", "19:00"])
      expect(r.visibleTimeSlots).toEqual(["18:00", "19:00"])
    })

    it("restricts visible time slots to a single already-selected slot during check-in", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isQrMobileCompactFlow: true,
          isCheckInFlow: true,
          date: "2026-06-26",
          time: "19:00",
        })
      )
      const r = getResult()

      expect(r.visibleTimeSlots).toEqual(["19:00"])
    })
  })

  describe("profile-booking flow", () => {
    it("produces packages -> payments -> review steps", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isProfileBookingFlow: true,
        })
      )
      const r = getResult()

      expect(r.stepKeys).toEqual(["packages", "payments", "review"])
      expect(r.packagesStepIndex).toBe(0)
      expect(r.paymentsStepIndex).toBe(1)
      expect(r.promoStepIndex).toBe(-1)
    })
  })

  describe("public web flow", () => {
    it("produces the full party -> datetime -> info -> payments -> review flow", async () => {
      const { getResult } = await renderHook(defaultInput())
      const r = getResult()

      expect(r.stepKeys).toEqual(["party", "datetime", "info", "payments", "review"])
      expect(r.steps.map((s) => s.label)).toEqual([
        "step_party",
        "step_datetime",
        "step_info",
        "step_payments",
        "step_review",
      ])
      expect(r.infoStepIndex).toBe(2)
      expect(r.paymentsStepIndex).toBe(3)
    })

    it("adds the photo step when required and not a check-in flow", async () => {
      const { getResult } = await renderHook(defaultInput({ requiresPhotoStep: true }))
      const r = getResult()

      expect(r.stepKeys).toEqual(["party", "datetime", "info", "photo", "payments", "review"])
      expect(r.photoStepIndex).toBe(3)
      expect(r.steps.find((s) => s.key === "photo")?.label).toBe("Photo")
    })

    it("computes regularServiceId/regularServicePrice from the non new-student service", async () => {
      const { getResult } = await renderHook(defaultInput())
      const r = getResult()

      expect(r.regularServiceId).toBe("regular")
      expect(r.regularServicePrice).toBe(20)
    })

    it("wires currentUserContact from the Clerk user object", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          user: {
            firstName: "Ana",
            lastName: "Diaz",
            primaryPhoneNumber: { phoneNumber: "+19175551212" },
            primaryEmailAddress: { emailAddress: "ana@example.com" },
          },
        })
      )
      const r = getResult()

      expect(r.currentUserContact.firstName).toBe("Ana")
      expect(r.currentUserContact.lastName).toBe("Diaz")
      expect(r.currentUserContact.email).toBe("ana@example.com")
      expect(r.currentUserContact.phone).toBe("+1 (917) 555-1212")
    })

    it("falls back to a placeholder phone and empty fields without a user", async () => {
      const { getResult } = await renderHook(defaultInput({ user: null }))
      const r = getResult()

      expect(r.currentUserContact).toEqual({
        firstName: "",
        lastName: "",
        email: "",
        phone: "+1 ",
        note: "",
      })
    })

    it("computes pricing and calendar links from the selected service/package/date/time", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          service: "regular",
          date: "2026-06-26",
          time: "18:00",
          participants: 2,
        })
      )
      const r = getResult()

      expect(r.pricing.serviceOpt?.id).toBe("regular")
      expect(r.pricing.subtotal).toBeGreaterThan(0)
      expect(r.pricing.total).toBe(r.pricing.subtotal - r.pricing.discount)
      expect(r.calendarLinks.eventDates).toBeTruthy()
      expect(r.calendarLinks.googleCalHref).toContain("calendar.google.com")
    })

    it("marks a same-day slot as expired past the late grace window and keeps future slots valid", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          date: "2026-06-26",
          checkInNow: new Date("2026-06-26T18:25:00-04:00"), // 20+ min after 18:00 slot
        })
      )
      const r = getResult()

      expect(r.checkInTodayIso).toBe("2026-06-26")
      expect(r.isSlotExpiredForCheckIn("18:00")).toBe(true)
      expect(r.isSlotExpiredForCheckIn("19:00")).toBe(false)
    })

    it("never expires slots outside of check-in flows", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: false,
          date: "2026-06-26",
          checkInNow: new Date("2026-06-26T23:59:00-04:00"),
        })
      )
      const r = getResult()

      expect(r.isSlotExpiredForCheckIn("18:00")).toBe(false)
    })

    it("formats the check-in summary date/time", async () => {
      const { getResult } = await renderHook(defaultInput({ date: "2026-06-26", time: "18:00" }))
      const r = getResult()

      expect(r.formattedSummaryDateTime).toEqual(expect.any(String))
      expect(r.formattedSummaryDateTime.length).toBeGreaterThan(0)
    })

    it("exposes a stepValidCtx snapshot that mirrors the live derived state", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          date: "2026-06-26",
          time: "18:00",
          participants: 3,
          paymentMethod: "onsite",
        })
      )
      const r = getResult()

      expect(r.stepValidCtx).toEqual({
        steps: r.steps,
        participants: 3,
        availableServices: r.availableServices,
        service: "regular",
        date: "2026-06-26",
        time: "18:00",
        consecutiveOfferLoading: false,
        contact: defaultContact(),
        requiresPhotoStep: false,
        photoSaved: false,
        consecutiveChoiceMade: false,
        paymentMethod: "onsite",
      })
    })

    it("locks the regular-fallback flag when the fallback phone key matches the current contact phone", async () => {
      const { getResult } = await renderHook(
        defaultInput({
          newStudentFallbackPhoneKey: "19175551212",
          contact: { ...defaultContact(), phone: "+1 917 555 1212" },
        })
      )
      const r = getResult()

      expect(r.regularFallbackLocked).toBe(true)
    })

    it("resolves effectiveInitialStep and signInModalVariant from flow flags", async () => {
      const { getResult } = await renderHook(defaultInput({ initialStep: 2 }))
      const r = getResult()

      expect(r.effectiveInitialStep).toBe(2)
      expect(r.signInModalVariant).toBeTruthy()
    })
  })

  describe("recomputation across re-renders", () => {
    it("recomputes steps when switching from kiosk new-student to kiosk existing", async () => {
      const { getResult, rerender } = await renderHook(
        defaultInput({ isCheckInFlow: true, isCheckInNewFlow: true, isKioskTerminalFlow: true })
      )
      expect(getResult().packagesStepIndex).toBe(1)
      expect(getResult().stepKeys).toEqual(["info", "packages", "payments"])

      await rerender(
        defaultInput({ isCheckInFlow: true, isCheckInExistingFlow: true, isKioskTerminalFlow: true })
      )

      expect(getResult().promoStepIndex).toBe(-1)
      expect(getResult().stepKeys).toEqual(["info", "packages", "payments"])
    })
  })
})
