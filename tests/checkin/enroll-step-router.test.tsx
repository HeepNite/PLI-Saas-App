import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import EnrollStepRouter from "@/components/front/courses/enroll/steps/EnrollStepRouter"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

vi.mock("@/components/front/checkin/ProfilePhotoCapture", () => ({
  default: () => React.createElement("div", { "data-testid": "profile-photo-capture" }, "ProfilePhotoCapture"),
}))

vi.mock("@/components/front/courses/enroll/steps/EnrollInfoStep", () => ({
  default: () => React.createElement("div", { "data-testid": "enroll-info-step" }, "EnrollInfoStep"),
}))

vi.mock("@/components/front/ui/CalendarPicker", () => ({
  default: () => React.createElement("div", { "data-testid": "calendar-picker" }, "CalendarPicker"),
}))

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
  },
}))

const baseCourse: CourseEnrollmentData = {
  slug: "salsa-nocturno",
  title: "Salsa Nocturno",
  enrollment: {
    services: [
      { id: "regular", label: "Regular", price: 20 },
      { id: "new-student", label: "New Student", price: 15 },
    ],
    packages: [],
    addons: [],
  },
  location: { address: "123 Dance St" },
  instructors: [{ name: "Juan" }],
  schedule: { day: "Monday", time: "20:00", starts: "2025-07-04", availableWeekdays: [1, 3], availableTimes: ["20:00", "21:00"] },
}

const baseContact: EnrollmentContact = {
  firstName: "Maria",
  lastName: "Garcia",
  email: "maria@example.com",
  phone: "+1 555-555-5555",
  note: "",
}

const noop = () => {}
const noopDispatch = () => {}

const basePhotoPolicy = {
  context: "qr_phone" as const,
  photoRequired: false,
  allowCameraCapture: true,
  allowGalleryUpload: true,
  uploadMode: "customer_self" as const,
}

function buildProps(overrides: Partial<React.ComponentProps<typeof EnrollStepRouter>> = {}): React.ComponentProps<typeof EnrollStepRouter> {
  return {
    activeStepKey: "party",
    isInline: false,
    isCheckInFlow: false,
    isCheckInNewFlow: false,
    isQrMobileCompactFlow: false,
    isKioskTerminalFlow: false,
    isNewStudent: false,
    isCheckInExistingFlow: false,
    isProfileBookingFlow: false,
    skipContactStep: false,
    availableServices: baseCourse.enrollment.services,
    hasNewStudentService: true,
    course: baseCourse,
    courseAvailableWeekdays: [1, 3],
    service: "regular",
    setService: noop,
    participants: 1,
    setParticipants: noop,
    pkg: "",
    setPkg: noop,
    addons: [],
    setAddons: noopDispatch,
    contact: baseContact,
    setContact: noopDispatch,
    date: "2025-07-04",
    setDate: noopDispatch,
    time: "20:00",
    setTime: noopDispatch,
    initialLoading: false,
    timeLoading: false,
    setTimeLoading: noopDispatch,
    checkInScheduleNotice: null,
    setCheckInScheduleNotice: noopDispatch,
    visibleTimeSlots: ["20:00", "21:00"],
    isSlotExpiredForCheckIn: () => false,
    to12h: (v: string) => v,
    getCurrentCourseTimesForDate: () => ["20:00"],
    photoPolicy: basePhotoPolicy,
    preparedAccount: null,
    setPreparedAccount: noopDispatch,
    setPhotoSaved: noopDispatch,
    setFormError: noopDispatch,
    requiresPhotoStep: false,
    step: 0,
    steps: [
      { key: "party", label: "Party" },
      { key: "datetime", label: "Date & Time" },
      { key: "info", label: "Info" },
      { key: "payments", label: "Payments" },
    ],
    stepKeys: ["party", "datetime", "info", "payments"],
    setStep: noop,
    photoStepIndex: -1,
    effectiveConsecutiveOffer: null,
    effectiveIsPackageHolder: false,
    consecutiveAccepted: false,
    setConsecutiveAccepted: noopDispatch,
    consecutiveChoiceMade: false,
    setConsecutiveChoiceMade: noopDispatch,
    consecutiveAddedCents: 0,
    setConsecutiveAddedCents: noopDispatch,
    kioskQrCheckoutLocked: false,
    couponInput: "",
    setCouponInput: noopDispatch,
    appliedCoupon: null,
    setAppliedCoupon: noopDispatch,
    subtotal: 20,
    total: 20,
    serviceOpt: baseCourse.enrollment.services[0],
    pkgOpt: null,
    addonsOpts: [],
    paymentMethod: "stripe",
    setPaymentMethod: noop,
    paymentMethodLabel: "Card",
    formatPackageMeta: () => undefined,
    activeNumericField: null,
    handleNumpadBackspace: noop,
    handleNumpadClear: noop,
    handleNumpadDigit: noop,
    kioskInfoPhase: "name-email",
    phoneTouched: false,
    setActiveNumericField: noopDispatch,
    setExistingAccountDetected: noopDispatch,
    setPendingAutoPay: noopDispatch,
    setPhoneTouched: noopDispatch,
    setRequiresSignIn: noopDispatch,
    setResumeAfterSignInStep: noopDispatch,
    setKioskInfoPhase: noopDispatch,
    shouldMaskKioskInfoContent: false,
    usesPhasedInfoForm: false,
    t: (key: string) => key,
    ...overrides,
  }
}

describe("EnrollStepRouter — per-step render", () => {
  it("renders the party step service selector without throwing", () => {
    const html = renderToStaticMarkup(<EnrollStepRouter {...buildProps({ activeStepKey: "party" })} />)
    expect(html).toContain("booking-service")
    expect(html).toContain("Regular")
  })

  it("renders the datetime step calendar without throwing", () => {
    const html = renderToStaticMarkup(<EnrollStepRouter {...buildProps({ activeStepKey: "datetime" })} />)
    expect(html).toContain("CalendarPicker")
  })

  it("renders the info step without throwing", () => {
    const html = renderToStaticMarkup(<EnrollStepRouter {...buildProps({ activeStepKey: "info" })} />)
    expect(html).toContain("EnrollInfoStep")
  })

  it("renders the photo step without throwing", () => {
    const html = renderToStaticMarkup(<EnrollStepRouter {...buildProps({ activeStepKey: "photo" })} />)
    expect(html).toContain("ProfilePhotoCapture")
  })

  it("renders the packages step without throwing when packages exist", () => {
    const courseWithPackages: CourseEnrollmentData = {
      ...baseCourse,
      enrollment: {
        ...baseCourse.enrollment,
        packages: [
          { id: "pkg-5", label: "5 Class Pack", price: 4500 },
        ],
      },
    }
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "packages",
          course: courseWithPackages,
          stepKeys: ["packages", "payments"],
        })}
      />
    )
    expect(html).toContain("5 Class Pack")
    expect(html).toContain("Drop-in")
  })

  it("renders the consecutive step with offer data without throwing", () => {
    const offer = {
      linkedCourseSlug: "bachata-fusion",
      linkedCourseTitle: "Bachata Fusion",
      linkedCourseTime: "21:00",
      dropInConsecutiveCents: 1000,
      packageHolderConsecutiveCents: 800,
      regularDropInCents: 2000,
      discountPercent: 50,
      hasAttendedFirstClass: true,
    }
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "consecutive",
          effectiveConsecutiveOffer: offer,
        })}
      />
    )
    expect(html).toContain("Bachata Fusion")
    expect(html).toContain("PROMO")
    expect(html).toContain("No thanks")
  })

  it("renders the consecutive step as empty when no offer is provided", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "consecutive",
          effectiveConsecutiveOffer: null,
        })}
      />
    )
    expect(html).not.toContain("PROMO")
  })

  it("renders the promo step with offer data without throwing", () => {
    const offer = {
      linkedCourseSlug: "bachata-fusion",
      linkedCourseTitle: "Bachata Fusion",
      linkedCourseTime: "21:00",
      dropInConsecutiveCents: 1000,
      packageHolderConsecutiveCents: 800,
      regularDropInCents: 2000,
      discountPercent: 50,
      hasAttendedFirstClass: true,
    }
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "promo",
          effectiveConsecutiveOffer: offer,
        })}
      />
    )
    expect(html).toContain("Bachata Fusion")
    expect(html).toContain("Add Second Class Promotion")
    expect(html).toContain("No thanks")
  })

  it("renders the promo step as an empty wrapper when no offer is provided", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "promo",
          effectiveConsecutiveOffer: null,
        })}
      />
    )
    expect(html).toBe('<div class="space-y-4"></div>')
  })

  it("renders the payments step without throwing", () => {
    const html = renderToStaticMarkup(<EnrollStepRouter {...buildProps({ activeStepKey: "payments" })} />)
    expect(html).toContain("payments_totalAmount")
    expect(html).toContain("payments_method")
  })

  it("renders the payment step with check-in review summary when isCheckInFlow is true", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "payments",
          isCheckInFlow: true,
        })}
      />
    )
    expect(html).toContain("reviewAndConfirm")
  })

  it("renders the review step without throwing for non-checkin flow", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "review",
          isCheckInFlow: false,
        })}
      />
    )
    expect(html).toContain("reviewAndConfirm")
  })

  it("does not render the review step content for check-in flow", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "review",
          isCheckInFlow: true,
        })}
      />
    )
    expect(html).not.toContain("reviewAndConfirm")
  })

  it("renders nothing visible for an unknown step key", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter {...buildProps({ activeStepKey: "unknown-step" })} />
    )
    expect(html.trim()).toBe("")
  })

  it("renders check-in schedule notice in datetime step when present", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "datetime",
          isCheckInFlow: true,
          checkInScheduleNotice: "Class starts in 10 minutes",
        })}
      />
    )
    expect(html).toContain("Class starts in 10 minutes")
  })
})

describe("EnrollStepRouter — party step behavior", () => {
  it("shows new-student preselected notice when isCheckInNewFlow and hasNewStudentService", () => {
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "party",
          isCheckInNewFlow: true,
          hasNewStudentService: true,
        })}
      />
    )
    expect(html).toContain("Service preselected for new students.")
  })

  it("renders addon checkboxes when course has addons", () => {
    const courseWithAddons: CourseEnrollmentData = {
      ...baseCourse,
      enrollment: {
        ...baseCourse.enrollment,
        addons: [{ id: "audio", label: "Audio Recording", price: 10 }],
      },
    }
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "party",
          course: courseWithAddons,
        })}
      />
    )
    expect(html).toContain("Audio Recording")
  })
})

describe("EnrollStepRouter — payments step package display", () => {
  it("shows the selected package label in the check-in review summary when isCheckInFlow and pkg is set", () => {
    const courseWithPackages: CourseEnrollmentData = {
      ...baseCourse,
      enrollment: {
        ...baseCourse.enrollment,
        packages: [{ id: "pkg-5", label: "5 Class Pack", price: 4500 }],
      },
    }
    const html = renderToStaticMarkup(
      <EnrollStepRouter
        {...buildProps({
          activeStepKey: "payments",
          isCheckInFlow: true,
          course: courseWithPackages,
          pkg: "pkg-5",
          stepKeys: ["info", "payments"],
        })}
      />
    )
    expect(html).toContain("5 Class Pack")
  })
})
