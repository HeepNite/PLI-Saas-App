import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import StepPayments from "@/components/front/courses/enroll/steps/StepPayments"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

const course = {
  slug: "salsa-timba",
  title: "Salsa Timba",
  schedule: { day: "Sunday", time: "18:00", starts: "Ongoing", availableWeekdays: [0], availableTimes: ["18:00"] },
  location: { address: "PLI" },
  instructors: [],
  enrollment: {
    services: [{ id: "dropin", label: "Drop-in", price: 20 }],
    packages: [],
    addons: [],
  },
} as CourseEnrollmentData

const renderPayments = (isKioskTerminalFlow: boolean) => renderToStaticMarkup(
  <StepPayments
    isCheckInFlow
    isKioskTerminalFlow={isKioskTerminalFlow}
    course={course}
    pkg=""
    service="dropin"
    date="2026-10-04"
    time="18:00"
    participants={1}
    contact={{ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+12015550123", note: "" }}
    addons={[]}
    to12h={(value) => value}
    consecutiveAccepted={false}
    consecutiveAddedCents={0}
    effectiveConsecutiveOffer={null}
    kioskQrCheckoutLocked={false}
    couponInput=""
    setCouponInput={vi.fn()}
    appliedCoupon={null}
    setAppliedCoupon={vi.fn()}
    subtotal={20}
    total={20}
    serviceOpt={course.enrollment.services[0]}
    pkgOpt={null}
    addonsOpts={[]}
    paymentMethod="stripe"
    setPaymentMethod={vi.fn()}
    t={(key) => key}
  />,
)

describe("booking payment channels", () => {
  it("offers only card and wallet payment in a remote QR/public booking", () => {
    const html = renderPayments(false)
    expect(html).not.toContain("payments_onSite")
    expect(html).toContain("Card, Apple Pay, Google Pay")
    expect(html).toContain("Pay with card or phone wallet.")
  })

  it("retains onsite cash for the trusted kiosk presentation", () => {
    const html = renderPayments(true)
    expect(html).toContain("payments_onSite")
    expect(html).toContain("payments_stripe")
  })
})
