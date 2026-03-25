import { describe, expect, it } from "vitest"
import {
  createEmptyKioskQrCheckoutState,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
  resolveKioskQrPhaseFromStatus,
  shouldPauseKioskInactivityForQrPhase,
} from "@/lib/checkin/kiosk-qr-payment"

describe("kiosk QR payment helpers", () => {
  it("enables the early info skip for kiosk existing customers with valid prefill", () => {
    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(true)
  })

  it("keeps the early info skip off when kiosk existing-customer context is incomplete", () => {
    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)

    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: false,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)
  })

  it("enables the auto-submit fast path only for kiosk existing-customer card checkouts with valid prefill", () => {
    expect(
      isKioskCardFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        paymentMethod: "stripe",
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(true)
  })

  it("keeps the auto-submit fast path off for cash or incomplete prefill", () => {
    expect(
      isKioskCardFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        paymentMethod: "onsite",
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)

    expect(
      isKioskCardFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        paymentMethod: "stripe",
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)
  })

  it("pauses kiosk inactivity only while the QR is active or waiting", () => {
    expect(shouldPauseKioskInactivityForQrPhase("qr_ready")).toBe(true)
    expect(shouldPauseKioskInactivityForQrPhase("waiting_for_payment")).toBe(true)
    expect(shouldPauseKioskInactivityForQrPhase("creating")).toBe(false)
    expect(shouldPauseKioskInactivityForQrPhase("expired")).toBe(false)
  })

  it("maps durable polling statuses to kiosk QR phases", () => {
    expect(resolveKioskQrPhaseFromStatus("open")).toBe("waiting_for_payment")
    expect(resolveKioskQrPhaseFromStatus("complete")).toBe("complete")
    expect(resolveKioskQrPhaseFromStatus("expired")).toBe("expired")
    expect(resolveKioskQrPhaseFromStatus("not_found")).toBe("expired")
  })

  it("creates an empty checkout state", () => {
    expect(createEmptyKioskQrCheckoutState()).toEqual({
      phase: "idle",
      sessionId: null,
      url: null,
      expiresAt: null,
      awaitingWebhook: false,
      purchaseId: null,
      paymentStatus: null,
      error: null,
    })
  })
})
