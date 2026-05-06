import { describe, expect, it } from "vitest"
import { hasTerminalSensitiveCustomerState, type TerminalSensitiveStateInput } from "@/lib/checkin/terminal-sensitive-state"

const baseState: TerminalSensitiveStateInput = {
  isKioskTerminalFlow: true,
  mode: "idle",
  bootstrapOpen: false,
  newBookingOpen: false,
  existingBookingOpen: false,
  phoneSignInOpen: false,
  packageOfferOpen: false,
  duplicatePurchaseOpen: false,
  consecutiveOfferOpen: false,
  consecutiveSuccessOpen: false,
  consecutiveErrorOpen: false,
  packageSuccessOpen: false,
  kioskPinOpen: false,
  kioskPinSessionActive: false,
  pendingLoginPhone: false,
}

describe("terminal sensitive customer state", () => {
  it("stays inactive when terminal is idle with no customer state", () => {
    expect(hasTerminalSensitiveCustomerState(baseState)).toBe(false)
  })

  it("activates when phone sign-in could expose customer PII", () => {
    expect(hasTerminalSensitiveCustomerState({ ...baseState, phoneSignInOpen: true })).toBe(true)
  })

  it("activates when customer bootstrap data is visible", () => {
    expect(hasTerminalSensitiveCustomerState({ ...baseState, bootstrapOpen: true })).toBe(true)
  })

  it("does not activate outside the kiosk terminal flow", () => {
    expect(
      hasTerminalSensitiveCustomerState({
        ...baseState,
        isKioskTerminalFlow: false,
        bootstrapOpen: true,
      })
    ).toBe(false)
  })
})
