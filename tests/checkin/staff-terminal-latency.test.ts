import { describe, expect, it } from "vitest"
import {
  KIOSK_PAYMENT_TRANSITION_MIN_MS,
  STAFF_TERMINAL_LATENCY_TARGETS_MS,
  getKioskPaymentTransitionRemainingMs,
  isWithinStaffTerminalLatencyTarget,
} from "@/lib/checkin/kiosk-qr-payment"

describe("staff terminal latency verification", () => {
  it("measures PIN-ready duration against the 2s target", () => {
    expect(isWithinStaffTerminalLatencyTarget("pin_ready", 1_800)).toBe(true)
    expect(isWithinStaffTerminalLatencyTarget("pin_ready", 2_001)).toBe(false)
    expect(STAFF_TERMINAL_LATENCY_TARGETS_MS.pinReady).toBe(2_000)
  })

  it("measures card next-step duration against the 1.5s target", () => {
    expect(isWithinStaffTerminalLatencyTarget("card_next_step", 1_400)).toBe(true)
    expect(isWithinStaffTerminalLatencyTarget("card_next_step", 1_501)).toBe(false)
    expect(STAFF_TERMINAL_LATENCY_TARGETS_MS.cardNextStep).toBe(1_500)
  })

  it("measures cash next-step duration against the 0.8s target", () => {
    expect(isWithinStaffTerminalLatencyTarget("cash_next_step", 700)).toBe(true)
    expect(isWithinStaffTerminalLatencyTarget("cash_next_step", 801)).toBe(false)
    expect(STAFF_TERMINAL_LATENCY_TARGETS_MS.cashNextStep).toBe(800)
  })

  it("preserves the 900ms kiosk overlay floor while allowing faster server work", () => {
    expect(KIOSK_PAYMENT_TRANSITION_MIN_MS).toBe(900)
    expect(getKioskPaymentTransitionRemainingMs(1_000, 1_000)).toBe(900)
    expect(getKioskPaymentTransitionRemainingMs(1_000, 1_350)).toBe(550)
    expect(getKioskPaymentTransitionRemainingMs(1_000, 1_901)).toBe(0)
  })
})
