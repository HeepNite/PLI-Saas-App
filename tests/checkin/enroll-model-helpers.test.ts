import { describe, expect, it, vi } from "vitest"
import { buildEnrollCalendarLinks } from "@/components/front/courses/enroll/model/enroll-calendar"
import { buildEnrollCheckoutPayload } from "@/components/front/courses/enroll/model/checkout-payload"
import { calculateEnrollPricing } from "@/components/front/courses/enroll/model/enroll-pricing"
import { resolveAvailableEnrollServices } from "@/components/front/courses/enroll/model/enroll-services"
import { validateEnrollBeforeSubmit } from "@/components/front/courses/enroll/model/enroll-validation"
import type { CourseEnrollmentData, EnrollmentContact } from "@/components/front/courses/types"

const course: CourseEnrollmentData = {
  slug: "salsa-nocturno",
  title: "Salsa Nocturno",
  location: { address: "16 Water St" },
  instructors: [{ name: "Nina" }],
  schedule: { day: "Friday", time: "20:00", starts: "2026-06-12" },
  enrollment: {
    services: [
      { id: "drop-in", label: "Drop-in", price: 25 },
      { id: "new-student", label: "New Student", price: 10 },
    ],
    packages: [{ id: "pack-4", label: "4 Classes", price: 80 }],
    addons: [{ id: "shoes", label: "Shoes", price: 5 }],
  },
}

const contact: EnrollmentContact = {
  firstName: "Ana",
  lastName: "Diaz",
  email: "ana@example.com",
  phone: "(917) 555-1212",
  note: "Front desk note",
}

describe("enroll model helpers", () => {
  it("removes new-student pricing from trusted profile booking service options", () => {
    expect(
      resolveAvailableEnrollServices({
        services: course.enrollment.services,
        isCheckInExistingFlow: false,
        skipContactStep: true,
      }).map((service) => service.id)
    ).toEqual(["drop-in"])

    expect(
      resolveAvailableEnrollServices({
        services: course.enrollment.services,
        isCheckInExistingFlow: false,
        skipContactStep: false,
      }).map((service) => service.id)
    ).toEqual(["drop-in", "new-student"])
  })

  it("calculates package pricing without charging the base service twice", () => {
    const pricing = calculateEnrollPricing({
      services: course.enrollment.services,
      packages: course.enrollment.packages,
      addons: course.enrollment.addons,
      serviceId: "drop-in",
      packageId: "pack-4",
      addonIds: ["shoes"],
      participants: 2,
      appliedCoupon: { code: "SAVE10", type: "percent", value: 10 },
      consecutiveAccepted: true,
      consecutiveAddedCents: 1_500,
    })

    expect(pricing.serviceCharge).toBe(0)
    expect(pricing.perPerson).toBe(85)
    expect(pricing.subtotal).toBe(170)
    expect(pricing.discount).toBe(17)
    expect(pricing.total).toBe(168)
  })

  it("validates enrollment submit inputs in the same step order as the modal", () => {
    expect(
      validateEnrollBeforeSubmit({
        services: course.enrollment.services,
        packages: course.enrollment.packages,
        addons: course.enrollment.addons,
        serviceId: "missing",
        packageId: "",
        addonIds: [],
        participants: 1,
        date: "2026-06-12",
        time: "20:00",
        contact,
        studentPin: "",
        studentPinConfirm: "",
        paymentMethod: "stripe",
        paymentsStepIndex: 4,
        total: 25,
      })
    ).toEqual({ step: 0, message: "Select a valid service." })

    expect(
      validateEnrollBeforeSubmit({
        services: course.enrollment.services,
        packages: course.enrollment.packages,
        addons: course.enrollment.addons,
        serviceId: "new-student",
        packageId: "",
        addonIds: [],
        participants: 1,
        date: "2026-06-12",
        time: "20:00",
        contact,
        studentPin: "1234",
        studentPinConfirm: "4321",
        contactStepIndex: 0,
        paymentMethod: "stripe",
        paymentsStepIndex: 4,
        total: 10,
      })
    ).toEqual({ step: 0, message: "PIN confirmation does not match." })

    expect(
      validateEnrollBeforeSubmit({
        services: course.enrollment.services,
        packages: course.enrollment.packages,
        addons: course.enrollment.addons,
        serviceId: "new-student",
        packageId: "",
        addonIds: [],
        participants: 1,
        date: "2026-06-12",
        time: "20:00",
        contact: { ...contact, phone: "+1 123" },
        studentPin: "1234",
        studentPinConfirm: "1234",
        contactStepIndex: 0,
        paymentMethod: "stripe",
        paymentsStepIndex: 1,
        total: 10,
      })
    ).toEqual({ step: 0, message: "Enter a valid US phone number." })

    expect(
      validateEnrollBeforeSubmit({
        services: course.enrollment.services,
        packages: course.enrollment.packages,
        addons: course.enrollment.addons,
        serviceId: "drop-in",
        packageId: "",
        addonIds: ["shoes"],
        participants: 1,
        date: "2026-06-12",
        time: "20:00",
        contact,
        studentPin: "",
        studentPinConfirm: "",
        paymentMethod: "stripe",
        paymentsStepIndex: 4,
        total: 30,
      })
    ).toBeNull()

    expect(
      validateEnrollBeforeSubmit({
        services: course.enrollment.services,
        packages: course.enrollment.packages,
        addons: course.enrollment.addons,
        serviceId: "drop-in",
        packageId: "",
        addonIds: [],
        participants: 1,
        date: "2026-06-12",
        time: "20:00",
        contact: { firstName: "", lastName: "", email: "", phone: "+1 ", note: "" },
        skipContactValidation: true,
        studentPin: "",
        studentPinConfirm: "",
        paymentMethod: "stripe",
        paymentsStepIndex: 2,
        total: 25,
      })
    ).toBeNull()
  })

  it("builds calendar links and ICS content from the selected class", () => {
    vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"))

    const links = buildEnrollCalendarLinks({
      course,
      serviceLabel: "Drop-in",
      participants: 1,
      total: 25,
      date: "2026-06-12",
      time: "20:00",
      classWord: "Class",
      googleDetails: "One participant, $25.00",
      icsDescription: "ICS details",
    })

    expect(links.eventDates?.start).toEqual(new Date("2026-06-12T20:00:00"))
    expect(links.googleCalHref).toContain("calendar.google.com")
    expect(decodeURIComponent(links.icsDataUri)).toContain("SUMMARY:Salsa Nocturno — Drop-in")
  })

  it("builds checkout payload including kiosk and consecutive fields", () => {
    const payload = buildEnrollCheckoutPayload({
      course,
      total: 40,
      date: "2026-06-12",
      time: "20:00",
      contact,
      participants: 1,
      addonIds: ["shoes"],
      appliedCoupon: { code: "SAVE5", type: "amount", value: 5 },
      packageId: "",
      serviceId: "new-student",
      photoFlowContext: "kiosk_terminal",
      kioskSessionFields: { kioskSessionToken: "ks_1" },
      checkInContextDate: "2026-06-12",
      checkInContextTime: "20:00",
      studentPin: "1234",
      studentPinConfirm: "1234",
      consecutiveAccepted: true,
      consecutiveAddedCents: 1_500,
      consecutiveOffer: {
        linkedCourseSlug: "bachata",
        linkedCourseTitle: "Bachata",
        linkedCourseTime: "21:00",
        dropInConsecutiveCents: 1_500,
        packageHolderConsecutiveCents: 1_000,
        regularDropInCents: 3_000,
        discountPercent: 50,
        hasAttendedFirstClass: true,
      },
      extra: { cashNote: "Paid cash" },
    })

    expect(payload).toMatchObject({
      amount: 4_000,
      addons: ["shoes"],
      coupon: "SAVE5",
      kioskSessionToken: "ks_1",
      studentPin: "1234",
      consecutiveLinkedCourseSlug: "bachata",
      consecutiveLinkedCourseTime: "21:00",
      cashNote: "Paid cash",
    })
  })
})
