// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import EnrollFormFooter from "@/components/front/courses/enroll/steps/EnrollFormFooter"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: Record<string, string> = { back: "Back", cancel: "Cancel", confirm: "Confirm", continue: "Continue" }
let root: Root | null = null
let container: HTMLDivElement | null = null

const renderFooter = async (overrides: Partial<React.ComponentProps<typeof EnrollFormFooter>> = {}) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  const props: React.ComponentProps<typeof EnrollFormFooter> = {
    step: 1,
    steps: [{ key: "info", label: "Info" }, { key: "payments", label: "Payments" }],
    activeStepKey: "payments",
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
  await act(async () => {
    root?.render(<EnrollFormFooter {...props} />)
    await Promise.resolve()
  })
  return [...container.querySelectorAll("button")].map((button) => button.textContent?.trim())
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  window.sessionStorage.clear()
  delete (window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge
  vi.unstubAllGlobals()
})

describe("EnrollFormFooter client bridge boundary", () => {
  it("preserves ordinary-browser QR fallback after hydration", async () => {
    await expect(renderFooter()).resolves.toEqual(["Back", "Show QR"])
  })

  it("preserves ordinary-browser QR renewal after hydration", async () => {
    await expect(renderFooter({
      kioskQrCheckout: { ...createEmptyKioskQrCheckoutState(), phase: "error" },
    })).resolves.toEqual(["Back", "Create new QR"])
  })

  it("fails closed after bounded recovery when the Android WebView bridge remains absent", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 11; SM-T500; wv) Version/4.0 Chrome/131" })
    window.sessionStorage.setItem("pli-native-bridge-recovery.v1", "attempted")

    const labels = await renderFooter()

    expect(labels).toEqual(["Back", "Reopen PLI app"])
    expect(container?.textContent).not.toContain("QR")
  })

  it("keeps Confirm when the Android WebView bridge is available", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 11; SM-T500; wv) Version/4.0 Chrome/131" })
    ;(window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge = { postMessage: vi.fn() }

    await expect(renderFooter()).resolves.toEqual(["Back", "Confirm"])
  })
})
