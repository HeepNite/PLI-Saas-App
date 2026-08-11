import { describe, it, expect, afterEach } from "vitest"
import { createHash } from "crypto"
import { hashStaffPin, isValidPinHash } from "@/lib/security/staff-pin-auth"

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

  it("REGRESSION: validates a CLERK_SECRET_KEY hash even when STAFF_PIN_PEPPER is set to a DIFFERENT value", () => {
    // Elvira's bug: PIN was written with CLERK_SECRET_KEY (all write paths), but
    // STAFF_PIN_PEPPER is set to another value. Dual-verify must still accept it
    // so a changed PIN can still sign into the staff area (previously → 401).
    process.env.STAFF_PIN_PEPPER = "dedicated-pepper"
    process.env.CLERK_SECRET_KEY = "clerk-secret"
    expect(isValidPinHash("1234", makeHash("1234", "salt4", "clerk-secret"))).toBe(true)
  })

  it("hashStaffPin roundtrips and keys the hash with the pepper (preferred secret)", () => {
    process.env.STAFF_PIN_PEPPER = "dedicated-pepper"
    process.env.CLERK_SECRET_KEY = "clerk-secret"
    const stored = hashStaffPin("1234")
    // isValidPinHash accepts it (roundtrip)…
    expect(isValidPinHash("1234", stored)).toBe(true)
    // …and it verifies specifically under the pepper, proving writes decouple
    // from CLERK_SECRET_KEY (survives a future Clerk key swap).
    const [salt] = stored.split(":")
    expect(stored).toBe(makeHash("1234", salt!, "dedicated-pepper"))
    expect(stored).not.toBe(makeHash("1234", salt!, "clerk-secret"))
  })

  it("fail-closed: throws when neither STAFF_PIN_PEPPER nor CLERK_SECRET_KEY is set (no guessable literal)", () => {
    delete process.env.STAFF_PIN_PEPPER
    delete process.env.CLERK_SECRET_KEY
    expect(() => isValidPinHash("1234", makeHash("1234", "salt5", "staff-pin"))).toThrow()
    expect(() => hashStaffPin("1234")).toThrow()
  })
})
