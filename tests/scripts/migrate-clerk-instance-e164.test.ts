import { describe, expect, it } from "vitest"

import { digitsToE164 } from "@/scripts/migrate-clerk-instance"

describe("digitsToE164", () => {
  it("prepends +1 for a bare 10-digit string", () => {
    expect(digitsToE164("2125551234")).toBe("+12125551234")
  })

  it("prepends + only for an 11-digit string already leading with 1 (no double country code)", () => {
    expect(digitsToE164("12125551234")).toBe("+12125551234")
  })

  it("rejects an 11-digit string that does not start with 1", () => {
    expect(digitsToE164("22125551234")).toBeUndefined()
  })

  it("rejects a bare digit string of any other length (too short)", () => {
    expect(digitsToE164("12345")).toBeUndefined()
  })

  it("rejects a bare digit string of any other length (too long)", () => {
    expect(digitsToE164("123456789012")).toBeUndefined()
  })

  it("validates an already +-prefixed value as-is, without prepending or stripping digits", () => {
    expect(digitsToE164("+12125551234")).toBe("+12125551234")
  })

  it("rejects an already +-prefixed value that fails length validation", () => {
    expect(digitsToE164("+123")).toBeUndefined()
  })
})
