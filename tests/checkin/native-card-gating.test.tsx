// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StepPayments from "@/components/front/courses/enroll/steps/StepPayments"
import EnrollFormFooter from "@/components/front/courses/enroll/steps/EnrollFormFooter"
import { KioskQuickRepeatOverlay } from "@/components/front/checkin/KioskQuickRepeatOverlay"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Listener = (event: { data: unknown }) => void
const UNAVAILABLE = "Card reader unavailable — please pay with cash or another method"
const CONNECTING = "Card reader is connecting…"

let root: Root | null = null
let container: HTMLDivElement | null = null
let emit: (status: string) => void = () => {}

function installEventBridge() {
  const listeners = new Set<Listener>()
  ;(window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge = {
    postMessage: vi.fn(),
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }
  emit = (status) => act(() => {
    const data = JSON.stringify({ version: 1, event: "readerStatus", payload: { status } })
    listeners.forEach((listener) => listener({ data }))
  })
}

async function mount(element: React.ReactElement) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(element)
    await Promise.resolve()
  })
  return container
}

const button = (label: string) =>
  [...(container?.querySelectorAll("button") ?? [])].find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  delete (window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge
})

const course = {
  slug: "salsa", title: "Salsa",
  schedule: { day: "Sunday", time: "18:00", starts: "Ongoing", availableWeekdays: [0], availableTimes: ["18:00"] },
  location: { address: "PLI" }, instructors: [],
  enrollment: { services: [{ id: "dropin", label: "Drop-in", price: 20 }], packages: [], addons: [] },
} as CourseEnrollmentData

const payments = (isKioskTerminalFlow = true) => (
  <StepPayments
    isCheckInFlow isKioskTerminalFlow={isKioskTerminalFlow} course={course} pkg="" service="dropin" date="2026-10-04" time="18:00"
    participants={1} contact={{ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+12015550123", note: "" }}
    addons={[]} to12h={(value) => value} consecutiveAccepted={false} consecutiveAddedCents={0} effectiveConsecutiveOffer={null}
    kioskQrCheckoutLocked={false} couponInput="" setCouponInput={vi.fn()} appliedCoupon={null} setAppliedCoupon={vi.fn()}
    subtotal={20} total={20} serviceOpt={course.enrollment.services[0]} pkgOpt={null} addonsOpts={[]}
    paymentMethod="onsite" setPaymentMethod={vi.fn()} t={(key) => key}
  />
)

describe("native card gating in the kiosk payment step", () => {
  it("disables only the card option while the reader is connecting or disconnected", async () => {
    installEventBridge()
    await mount(payments())

    emit("connecting")
    expect(button("payments_stripe").disabled).toBe(true)
    expect(container?.textContent).toContain(CONNECTING)
    expect(button("payments_onSite").disabled).toBe(false)
    expect(container?.querySelector("[data-reader-status='connecting']")).not.toBeNull()

    emit("disconnected")
    expect(container?.textContent).toContain(UNAVAILABLE)
    expect(container?.querySelector("[data-reader-status='disconnected']")).not.toBeNull()

    emit("connected")
    expect(button("payments_stripe").disabled).toBe(false)
    expect(container?.textContent).not.toContain(UNAVAILABLE)
    expect(container?.querySelector("[data-reader-status='connected']")).not.toBeNull()
  })

  it("keeps today's card option and shows no status dot without a bridge", async () => {
    await mount(payments())

    expect(button("payments_stripe").disabled).toBe(false)
    expect(container?.querySelector("[data-reader-status]")).toBeNull()
  })

  it("keeps the card option until the native app reports a status", async () => {
    installEventBridge()
    await mount(payments())

    expect(button("payments_stripe").disabled).toBe(false)
    expect(container?.querySelector("[data-reader-status]")).toBeNull()
  })

  it("blocks the final card confirmation while the reader is not ready", async () => {
    installEventBridge()
    await mount(
      <EnrollFormFooter
        step={1} steps={[{ key: "info", label: "Info" }, { key: "payments", label: "Payments" }]} activeStepKey="payments"
        isInline usesPhasedInfoForm kioskInfoPhase="phone" kioskQrCheckoutLocked={false}
        kioskQrCheckout={createEmptyKioskQrCheckoutState()} isKioskTerminalFlow paymentMethod="stripe" processing={false}
        identityCheckBusy={false} consecutiveOfferLoading={false} canContinueCurrentStep handleClose={vi.fn()}
        handleSubmit={vi.fn()} resetKioskQrCheckout={vi.fn()} setStep={vi.fn()} setKioskInfoPhase={vi.fn()}
        setActiveNumericField={vi.fn()} t={(key) => (key === "confirm" ? "Confirm" : key)}
      />,
    )

    emit("disconnected")
    expect(button("Card reader unavailable").disabled).toBe(true)

    emit("connected")
    expect(button("Confirm").disabled).toBe(false)
  })
})

describe("native card gating in Quick Repeat", () => {
  const bootstrap = {
    context: { courseSlug: "salsa", courseTitle: "Salsa", date: "2026-10-22", time: "19:00" },
    customer: { firstName: "Jane" },
    lastPurchasePattern: { amount: 2000, paymentChannel: "card" },
    consecutiveOffer: null,
  } as unknown as BootstrapResponse

  const overlay = () => (
    <KioskQuickRepeatOverlay
      bootstrap={bootstrap} qrCheckout={createEmptyKioskQrCheckoutState()} onConfirm={vi.fn()} onDecline={vi.fn()}
      isProcessing={false} success={false}
    />
  )

  it("disables Pay by Card with a reason while cash stays available", async () => {
    installEventBridge()
    await mount(overlay())

    emit("disconnected")
    expect(button("Pay by Card").disabled).toBe(true)
    expect(button("Pay Cash").disabled).toBe(false)
    expect(container?.textContent).toContain(UNAVAILABLE)

    emit("connected")
    expect(button("Pay by Card").disabled).toBe(false)
    expect(container?.querySelector("[data-reader-status='connected']")).not.toBeNull()
  })
})
