import { describe, expect, it } from "vitest"

import {
  buildExactPhoneLookup,
  formatNationalDraft,
  getPhoneCountryCatalog,
  parseCanonicalPhone,
  parseNationalPhone,
  type ParsedPhone,
  type PhoneParseResult,
} from "@/lib/phone"

const parsedPhone = (result: PhoneParseResult): ParsedPhone => {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(`Expected a parsed phone, received ${result.reason}`)
  return result.phone
}

describe("phone domain", () => {
  it("uses metadata-backed country calling codes", () => {
    const catalog = new Map(getPhoneCountryCatalog().map((entry) => [entry.country, entry.callingCode]))
    expect(catalog.get("US")).toBe("1")
    expect(catalog.get("MX")).toBe("52")
    expect(catalog.get("AR")).toBe("54")
  })

  it.each([
    ["US", "2025550123", "+12025550123"],
    ["MX", "5512345678", "+525512345678"],
    ["AR", "91123456789", "+5491123456789"],
  ] as const)("canonicalizes valid %s national input", (country, input, e164) => {
    expect(parsedPhone(parseNationalPhone(input, country))).toMatchObject({ country, e164, digits: e164.slice(1) })
  })

  it.each([
    ["+12025550123", "invalid"],
    ["Call me at 2025550123", "invalid"],
    ["202", "incomplete"],
  ] as const)("rejects strict national input %j", (input, reason) => {
    expect(parseNationalPhone(input, "US")).toEqual({ ok: false, reason })
  })

  it("rejects formatted or surrounding-text canonical values", () => {
    expect(parseCanonicalPhone("+1 (202) 555-0123")).toEqual({ ok: false, reason: "invalid" })
    expect(parseCanonicalPhone("Call +12025550123")).toEqual({ ok: false, reason: "invalid" })
  })

  it("formats national drafts without a universal length cap", () => {
    expect(formatNationalDraft("2025550123", "US")).toBe("(202) 555-0123")
    expect(formatNationalDraft("1234567890123456", "US").replace(/\D/g, "")).toBe("1234567890123456")
  })

  it("adds a legacy candidate only for valid US numbers", () => {
    expect(buildExactPhoneLookup(parsedPhone(parseCanonicalPhone("+12025550123")))).toEqual({
      e164: "+12025550123",
      digitCandidates: ["12025550123", "2025550123"],
    })
    expect(buildExactPhoneLookup(parsedPhone(parseCanonicalPhone("+525512345678"))).digitCandidates).toEqual(["525512345678"])
  })
})
