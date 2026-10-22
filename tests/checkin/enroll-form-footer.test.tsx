import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import EnrollFormFooter from "@/components/front/courses/enroll/steps/EnrollFormFooter"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

const labels: Record<string, string> = {
  back: "Back",
  cancel: "Cancel",
  confirm: "Confirm",
  continue: "Continue",
  verifyingAccount: "Verifying account...",
}

const renderFooter = (overrides: Partial<React.ComponentProps<typeof EnrollFormFooter>> = {}) => {
  const props: React.ComponentProps<typeof EnrollFormFooter> = {
    step: 0,
    steps: [{ key: "info", label: "Info" }, { key: "datetime", label: "Date" }],
    activeStepKey: "info",
    isInline: true,
    usesPhasedInfoForm: true,
    kioskInfoPhase: "phone",
    kioskQrCheckoutLocked: false,
    kioskQrCheckout: createEmptyKioskQrCheckoutState(),
    isKioskTerminalFlow: true,
    paymentMethod: "stripe",
    processing: false,
    identityCheckBusy: false,
    consecutiveOfferLoading: false,
    canContinueCurrentStep: true,
    handleClose: vi.fn(),
    handleSubmit: vi.fn(),
    resetKioskQrCheckout: vi.fn(),
    setStep: vi.fn(),
    setKioskInfoPhase: vi.fn(),
    setActiveNumericField: vi.fn(),
    t: (key) => labels[key] ?? key,
    ...overrides,
  }

  return renderToStaticMarkup(<EnrollFormFooter {...props} />)
}

const buttonLabels = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((match) => match[1].trim())

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("EnrollFormFooter", () => {
  it("shows exactly Cancel and Continue on one row in the initial phase", () => {
    const html = renderFooter()

    expect(buttonLabels(html)).toEqual(["Cancel", "Continue"])
    expect(html).not.toContain("My panel")
    expect(html).not.toContain("flex-col")
  })

  it("replaces Cancel with Back in a later information phase", () => {
    const html = renderFooter({ kioskInfoPhase: "name-email" })

    expect(buttonLabels(html)).toEqual(["Back", "Continue"])
  })

  it("serializes a neutral action instead of QR before client hydration", () => {
    const html = renderFooter({ step: 1, activeStepKey: "datetime" })

    expect(buttonLabels(html)).toEqual(["Back", "Checking reader..."])
    expect(html).not.toContain("Show QR")
    expect(html).not.toContain("Create new QR")
  })

  it("never serializes QR before hydration even when the request environment resembles the Android WebView", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 11; SM-T500; wv) Version/4.0 Chrome/131" })

    const html = renderFooter({ step: 1, activeStepKey: "datetime" })

    expect(buttonLabels(html)).toEqual(["Back", "Checking reader..."])
    expect(html).not.toContain("Show QR")
    expect(html).not.toContain("Create new QR")
  })

  it.each(["expired", "error"] as const)("does not serialize Create new QR for %s before hydration", (phase) => {
    const html = renderFooter({
      step: 1,
      activeStepKey: "datetime",
      kioskQrCheckout: { ...createEmptyKioskQrCheckoutState(), phase },
    })

    expect(buttonLabels(html)).toEqual(["Back", "Checking reader..."])
    expect(html).not.toContain("Create new QR")
  })
})
