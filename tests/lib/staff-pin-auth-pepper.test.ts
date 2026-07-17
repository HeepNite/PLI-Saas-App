import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createHash } from "crypto"
import { isValidPinHash } from "@/lib/security/staff-pin-auth"

const buildHash = (pin: string, salt: string, pepper: string) =>
  `${salt}:${createHash("sha256").update(`${pin}:${salt}:${pepper}`).digest("hex")}`

describe("staff-pin-auth pepper resolution", () => {
  const originalStaffPinPepper = process.env.STAFF_PIN_PEPPER
  const originalClerkSecretKey = process.env.CLERK_SECRET_KEY

  beforeEach(() => {
    delete process.env.STAFF_PIN_PEPPER
    delete process.env.CLERK_SECRET_KEY
  })

  afterEach(() => {
    if (originalStaffPinPepper === undefined) {
      delete process.env.STAFF_PIN_PEPPER
    } else {
      process.env.STAFF_PIN_PEPPER = originalStaffPinPepper
    }
    if (originalClerkSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY
    } else {
      process.env.CLERK_SECRET_KEY = originalClerkSecretKey
    }
  })

  // Scenario: STAFF_PIN_PEPPER set wins over CLERK_SECRET_KEY
  it("uses STAFF_PIN_PEPPER when set, even if CLERK_SECRET_KEY is also set", () => {
    process.env.STAFF_PIN_PEPPER = "new-pepper-value"
    process.env.CLERK_SECRET_KEY = "sk_live_something"

    const hash = buildHash("1234", "salt123", "new-pepper-value")

    expect(isValidPinHash("1234", hash)).toBe(true)
  })

  it("rejects a hash built with CLERK_SECRET_KEY when STAFF_PIN_PEPPER is set to a different value", () => {
    process.env.STAFF_PIN_PEPPER = "new-pepper-value"
    process.env.CLERK_SECRET_KEY = "sk_live_something"

    const hash = buildHash("1234", "salt123", "sk_live_something")

    expect(isValidPinHash("1234", hash)).toBe(false)
  })

  // Scenario: STAFF_PIN_PEPPER unset — falls back to CLERK_SECRET_KEY
  it("falls back to CLERK_SECRET_KEY when STAFF_PIN_PEPPER is unset", () => {
    process.env.CLERK_SECRET_KEY = "sk_test_old_value"

    const hash = buildHash("1234", "salt123", "sk_test_old_value")

    expect(isValidPinHash("1234", hash)).toBe(true)
  })

  // Scenario: both unset — falls back to the "staff-pin" literal
  it("falls back to the literal \"staff-pin\" when both STAFF_PIN_PEPPER and CLERK_SECRET_KEY are unset", () => {
    const hash = buildHash("1234", "salt123", "staff-pin")

    expect(isValidPinHash("1234", hash)).toBe(true)
  })

  // Scenario: existing hash created with old CLERK_SECRET_KEY still verifies
  // once STAFF_PIN_PEPPER is seeded with that same value (key-swap survival).
  it("verifies an existing hash after STAFF_PIN_PEPPER is seeded with the prior CLERK_SECRET_KEY value", () => {
    // Simulate pre-swap: hash created while CLERK_SECRET_KEY held the sk_test value.
    process.env.CLERK_SECRET_KEY = "sk_test_pre_swap"
    const hash = buildHash("1234", "salt123", "sk_test_pre_swap")

    // Simulate the seeding step: STAFF_PIN_PEPPER now holds the same old value,
    // and CLERK_SECRET_KEY has been swapped to sk_live.
    process.env.STAFF_PIN_PEPPER = "sk_test_pre_swap"
    process.env.CLERK_SECRET_KEY = "sk_live_post_swap"

    expect(isValidPinHash("1234", hash)).toBe(true)
  })
})
