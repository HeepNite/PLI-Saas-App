import { createHash, timingSafeEqual } from "crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getStaffPinSecret, hashPin, isValidPinHash } from "@/lib/security/staff-pin-hash"

const ORIGINAL_CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY

// Mirrors the OLD per-site hashing scheme (sha256(pin:salt:secret)) that every
// call site used before centralization, to prove the shared module verifies
// hashes created under the pre-existing scheme with no desync / no lockout.
const legacyHashPin = (pin: string, salt: string, secret: string) => {
  const hash = createHash("sha256").update(`${pin}:${salt}:${secret}`).digest("hex")
  return `${salt}:${hash}`
}

describe("staff-pin-hash", () => {
  afterEach(() => {
    if (ORIGINAL_CLERK_SECRET_KEY === undefined) {
      delete process.env.CLERK_SECRET_KEY
    } else {
      process.env.CLERK_SECRET_KEY = ORIGINAL_CLERK_SECRET_KEY
    }
  })

  describe("getStaffPinSecret", () => {
    it("throws when CLERK_SECRET_KEY is unset (fail-closed, no literal fallback)", () => {
      delete process.env.CLERK_SECRET_KEY

      expect(() => getStaffPinSecret()).toThrow()
    })

    it("throws when CLERK_SECRET_KEY is an empty string", () => {
      process.env.CLERK_SECRET_KEY = ""

      expect(() => getStaffPinSecret()).toThrow()
    })

    it("returns CLERK_SECRET_KEY when configured", () => {
      process.env.CLERK_SECRET_KEY = "test-secret"

      expect(getStaffPinSecret()).toBe("test-secret")
    })
  })

  describe("hashPin / isValidPinHash round-trip", () => {
    beforeEach(() => {
      process.env.CLERK_SECRET_KEY = "test-secret"
    })

    it("a hash created and verified through the module round-trips with the same secret", () => {
      const pinHash = hashPin("1234")

      expect(isValidPinHash("1234", pinHash)).toBe(true)
    })

    it("rejects an incorrect PIN against a valid hash", () => {
      const pinHash = hashPin("1234")

      expect(isValidPinHash("9999", pinHash)).toBe(false)
    })

    it("rejects a malformed hash without throwing", () => {
      expect(isValidPinHash("1234", "not-a-valid-hash")).toBe(false)
    })

    it("throws when hashing without a configured secret (fail-closed on create)", () => {
      delete process.env.CLERK_SECRET_KEY

      expect(() => hashPin("1234")).toThrow()
    })

    it("throws when verifying without a configured secret (fail-closed on verify)", () => {
      const pinHash = hashPin("1234")
      delete process.env.CLERK_SECRET_KEY

      expect(() => isValidPinHash("1234", pinHash)).toThrow()
    })
  })

  describe("no desync with the pre-centralization hashing scheme", () => {
    beforeEach(() => {
      process.env.CLERK_SECRET_KEY = "test-secret"
    })

    it("verifies a hash created under the OLD sha256(pin:salt:CLERK_SECRET_KEY) scheme", () => {
      const salt = "legacy-salt"
      const legacyHash = legacyHashPin("4242", salt, "test-secret")

      expect(isValidPinHash("4242", legacyHash)).toBe(true)
    })

    it("cross-check: module hash matches independently computed sha256(pin:salt:secret)", () => {
      const pinHash = hashPin("4242")
      const [salt, expectedHash] = pinHash.split(":")
      const recomputed = createHash("sha256").update(`4242:${salt}:test-secret`).digest("hex")

      expect(timingSafeEqual(Buffer.from(expectedHash!, "hex"), Buffer.from(recomputed, "hex"))).toBe(true)
    })
  })
})
