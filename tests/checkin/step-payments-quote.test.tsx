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

const renderPayments = (quote: {
  isPublicQuoteBooking?: boolean
  publicQuote?: { amountCents: number; currency: string; promotionLabel?: string } | null
  publicQuoteLoading?: boolean
  publicQuoteError?: string | null
} = {}) => renderToStaticMarkup(
  <StepPayments
    isCheckInFlow={false}
    isKioskTerminalFlow={false}
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
    {...quote}
  />,
)

describe("StepPayments public quote summary", () => {
  it("shows an updating state instead of the local total while an ordinary public quote loads", () => {
    const html = renderPayments({ isPublicQuoteBooking: true, publicQuoteLoading: true })

    expect(html).toContain("Updating price")
    expect(html).not.toContain("$20.00")
  })

  it("shows a generic unavailable state when an ordinary public quote fails or is missing", () => {
    const html = renderPayments({ isPublicQuoteBooking: true, publicQuoteError: "request failed" })
    const missingHtml = renderPayments({ isPublicQuoteBooking: true })

    expect(html).toContain("Price unavailable")
    expect(html).not.toContain("request failed")
    expect(html).not.toContain("$20.00")
    expect(missingHtml).toContain("Price unavailable")
    expect(missingHtml).not.toContain("$20.00")
  })

  it("shows the authoritative regular quote as the final total", () => {
    const html = renderPayments({
      isPublicQuoteBooking: true,
      publicQuote: { amountCents: 2000, currency: "usd" },
    })

    expect(html).toContain("Final total")
    expect(html).toContain("$20.00")
    expect(html).not.toContain("Promotion adjustment")
  })

  it("shows the applied promotion and display-only savings for a lower quote", () => {
    const html = renderPayments({
      isPublicQuoteBooking: true,
      publicQuote: { amountCents: 1500, currency: "usd", promotionLabel: "Heritage promotion" },
    })

    expect(html).toContain("Applied promotion: Heritage promotion")
    expect(html).toContain("Promotion adjustment")
    expect(html).toContain("You save $5.00")
    expect(html).toContain("Final total")
    expect(html).toContain("$15.00")
    expect(html).not.toContain("$20.00")
  })

  it("keeps non-public summaries on their local total", () => {
    const html = renderPayments({
      publicQuote: { amountCents: 1500, currency: "usd", promotionLabel: "Heritage promotion" },
    })

    expect(html).toContain("payments_totalAmount")
    expect(html).toContain("$20.00")
    expect(html).not.toContain("Final total")
    expect(html).not.toContain("Heritage promotion")
  })
})
