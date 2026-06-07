import { describe, expect, it } from "vitest"
import {
  buildTerminalPinAlert,
  getTerminalAttemptsRemaining,
  resolveKioskPinThrottleSeverity,
} from "@/lib/security/kiosk-pin-throttle"

describe("kiosk PIN throttle helpers", () => {
  it("escalates from normal to warning, cooldown, and emergency", () => {
    expect(resolveKioskPinThrottleSeverity({ missCount: 1 })).toBe("normal")
    expect(resolveKioskPinThrottleSeverity({ missCount: 3 })).toBe("warning")
    expect(
      resolveKioskPinThrottleSeverity({
        missCount: 5,
        blockedUntil: new Date("2026-03-26T12:01:00.000Z"),
        now: new Date("2026-03-26T12:00:00.000Z"),
      })
    ).toBe("cooldown")
    expect(
      resolveKioskPinThrottleSeverity({
        missCount: 10,
        blockedUntil: new Date("2026-03-26T12:05:00.000Z"),
        now: new Date("2026-03-26T12:00:00.000Z"),
      })
    ).toBe("emergency")
  })

  it("computes attempts remaining before staff assistance is recommended", () => {
    expect(getTerminalAttemptsRemaining(0)).toBe(5)
    expect(getTerminalAttemptsRemaining(3)).toBe(2)
    expect(getTerminalAttemptsRemaining(5)).toBe(0)
  })

  it("builds remote alerts only for active warning/cooldown/emergency states", () => {
    expect(
      buildTerminalPinAlert({
        missCount: 4,
        windowStart: new Date("2026-03-26T11:55:00.000Z"),
        now: new Date("2026-03-26T12:00:00.000Z"),
      })
    ).toMatchObject({ severity: "warning", label: "Repeated PIN failures" })

    expect(
      buildTerminalPinAlert({
        missCount: 5,
        blockedUntil: new Date("2026-03-26T12:01:00.000Z"),
        windowStart: new Date("2026-03-26T11:55:00.000Z"),
        now: new Date("2026-03-26T12:00:00.000Z"),
      })
    ).toMatchObject({ severity: "cooldown", label: "PIN cooldown active" })

    expect(
      buildTerminalPinAlert({
        missCount: 1,
        windowStart: new Date("2026-03-26T11:30:00.000Z"),
        now: new Date("2026-03-26T12:00:00.000Z"),
      })
    ).toBeNull()
  })
})
