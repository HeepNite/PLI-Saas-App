import { describe, it, expect, afterEach } from "vitest"
import { createHash } from "crypto"
import { isValidPinHash } from "@/lib/security/staff-pin-auth"

const makeHash = (pin: string, salt: string, pepper: string) =>
  `${salt}:${createHash("sha256").update(`${pin}:${salt}:${pepper}`).digest("hex")}`

const restore = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

describe("staff PIN pepper decoupling (survives Clerk key swap)", () => {
  const origPepper = process.env.STAFF_PIN_PEPPER
  const origClerk = process.env.CLERK_SECRET_KEY

  afterEach(() => {
    restore("STAFF_PIN_PEPPER", origPepper)
    restore("CLERK_SECRET_KEY", origClerk)
  })

  it("validates a hash made with CLERK_SECRET_KEY when STAFF_PIN_PEPPER is unset (backward compatible)", () => {
    delete process.env.STAFF_PIN_PEPPER
    process.env.CLERK_SECRET_KEY = "old-secret"
    expect(isValidPinHash("1234", makeHash("1234", "salt1", "old-secret"))).toBe(true)
  })

  it("keeps validating a legacy hash after CLERK_SECRET_KEY changes, when STAFF_PIN_PEPPER holds the old value", () => {
    // The cutover scenario: pepper seeded with the old value BEFORE swapping the key.
    process.env.STAFF_PIN_PEPPER = "old-secret"
    process.env.CLERK_SECRET_KEY = "new-secret-after-swap"
    expect(isValidPinHash("1234", makeHash("1234", "salt2", "old-secret"))).toBe(true)
  })

  it("rejects a wrong pin", () => {
    process.env.STAFF_PIN_PEPPER = "old-secret"
    expect(isValidPinHash("9999", makeHash("1234", "salt3", "old-secret"))).toBe(false)
  })
})
