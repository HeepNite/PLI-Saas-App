// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import StepPayments from "@/components/front/courses/enroll/steps/StepPayments"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const renderPayments = ({
  isCheckInFlow = true,
  isKioskTerminalFlow = false,
  isOrdinaryPublicBooking = false,
}: {
  isCheckInFlow?: boolean
  isKioskTerminalFlow?: boolean
  isOrdinaryPublicBooking?: boolean
} = {}) => renderToStaticMarkup(
  <StepPayments
    isCheckInFlow={isCheckInFlow}
    isKioskTerminalFlow={isKioskTerminalFlow}
    isOrdinaryPublicBooking={isOrdinaryPublicBooking}
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

const roots: Root[] = []
afterEach(() => {
  roots.splice(0).forEach((root) => root.unmount())
})

describe("booking payment channels", () => {
  it("offers only card and wallet payment in a remote QR/public booking", () => {
    const html = renderPayments()
    expect(html).not.toContain("payments_onSite")
    expect(html).toContain("Card, Apple Pay, Google Pay")
    expect(html).toContain("Pay with card or phone wallet.")
  })

  it("hides onsite cash for ordinary public booking", () => {
    const html = renderPayments({ isCheckInFlow: false, isOrdinaryPublicBooking: true })
    expect(html).not.toContain("payments_onSite")
    expect(html).toContain("payments_stripe")
  })

  it("resets an onsite selection when the booking becomes public", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)
    const setPaymentMethod = vi.fn()
    const render = async (isOrdinaryPublicBooking: boolean) => {
      await act(async () => {
        root.render(
          <StepPayments
            isCheckInFlow={false}
            isKioskTerminalFlow={false}
            isOrdinaryPublicBooking={isOrdinaryPublicBooking}
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
            paymentMethod="onsite"
            setPaymentMethod={setPaymentMethod}
            t={(key) => key}
          />,
        )
      })
    }

    await render(false)
    await render(true)

    expect(setPaymentMethod).toHaveBeenCalledWith("stripe")
  })

  it("retains onsite cash for the trusted kiosk presentation", () => {
    const html = renderPayments({ isKioskTerminalFlow: true })
    expect(html).toContain("payments_onSite")
    expect(html).toContain("payments_stripe")
  })

  it("retains onsite cash for legacy non-public booking", () => {
    const html = renderPayments({ isCheckInFlow: false })
    expect(html).toContain("payments_onSite")
  })
})
