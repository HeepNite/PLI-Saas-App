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

const expectParsedPhone = (result: PhoneParseResult): ParsedPhone => {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(`Expected a parsed phone, received ${result.reason}`)
  return result.phone
}

describe("phone domain", () => {
  describe("country catalog", () => {
    it("exposes the global metadata catalog with calling codes", () => {
      const catalog = getPhoneCountryCatalog()
      const countries = new Map(catalog.map((entry) => [entry.country, entry.callingCode]))

      expect(catalog.length).toBeGreaterThan(200)
      expect(countries.get("US")).toBe("1")
      expect(countries.get("MX")).toBe("52")
      expect(countries.get("EC")).toBe("593")
      expect(countries.get("PE")).toBe("51")
      expect(countries.get("AR")).toBe("54")
      expect(countries.get("CL")).toBe("56")
    })
  })

  describe("national parsing", () => {
    const validExamples = [
      { country: "US", input: "2025550123", e164: "+12025550123" },
      { country: "MX", input: "5512345678", e164: "+525512345678" },
      { country: "EC", input: "991234567", e164: "+593991234567" },
      { country: "PE", input: "987654321", e164: "+51987654321" },
      { country: "AR", input: "91123456789", e164: "+5491123456789" },
      { country: "CL", input: "961234567", e164: "+56961234567" },
      { country: "DE", input: "30123456", e164: "+4930123456" },
    ] as const

    it.each(validExamples)(
      "canonicalizes a valid $country national number",
      ({ country, input, e164 }) => {
        const phone = expectParsedPhone(parseNationalPhone(input, country))

        expect(phone).toMatchObject({
          country,
          e164,
          digits: e164.slice(1),
        })
        expect(phone.callingCode).not.toBe("")
        expect(phone.nationalNumber).not.toBe("")
        expect(phone.nationalDisplay).not.toBe("")
      }
    )

    it("uses the explicit country for a shared calling code", () => {
      const canadian = expectParsedPhone(parseNationalPhone("4165550123", "CA"))

      expect(canadian.country).toBe("CA")
      expect(canadian.callingCode).toBe("1")
      expect(parseNationalPhone("4165550123", "US")).toEqual({
        ok: false,
        reason: "unsupported_country",
      })
    })

    it.each([
      ["", "empty"],
      ["202", "incomplete"],
      ["0000000000", "invalid"],
      ["+12025550123", "invalid"],
      ["Call me at 2025550123", "invalid"],
      ["20255501234567890", "invalid"],
    ] as const)("rejects %j as %s", (input, reason) => {
      expect(parseNationalPhone(input, "US")).toEqual({ ok: false, reason })
    })

    it("rejects a country absent from the metadata catalog", () => {
      expect(parseNationalPhone("2025550123", "ZZ" as never)).toEqual({
        ok: false,
        reason: "unsupported_country",
      })
    })
  })

  describe("canonical parsing", () => {
    it("returns parser-owned E.164 and digits", () => {
      const phone = expectParsedPhone(parseCanonicalPhone("+525512345678"))

      expect(phone).toMatchObject({
        country: "MX",
        callingCode: "52",
        e164: "+525512345678",
        digits: "525512345678",
      })
    })

    it.each([
      ["", "empty"],
      ["+1202", "incomplete"],
      ["2025550123", "invalid"],
      ["+1 (202) 555-0123", "invalid"],
      ["Call me at +12025550123", "invalid"],
      ["+12005550123", "unresolved_country"],
      ["+80012345678", "non_geographic"],
    ] as const)("rejects %j as %s", (input, reason) => {
      expect(parseCanonicalPhone(input)).toEqual({ ok: false, reason })
    })
  })

  describe("national formatting", () => {
    it("formats a national draft without changing its digits", () => {
      expect(formatNationalDraft("2025550123", "US")).toBe("(202) 555-0123")
      expect(formatNationalDraft("202-555-0123", "US").replace(/\D/g, "")).toBe(
        "2025550123"
      )
    })

    it("does not impose a universal phone-length cap", () => {
      const digits = "1234567890123456"

      expect(formatNationalDraft(digits, "US").replace(/\D/g, "")).toBe(digits)
    })

    it("fails closed for an unsupported country", () => {
      expect(formatNationalDraft("2025550123", "ZZ" as never)).toBe("")
    })
  })

  describe("exact lookup candidates", () => {
    it("adds the parser-derived national number only for US phones", () => {
      const phone = expectParsedPhone(parseCanonicalPhone("+12025550123"))

      expect(buildExactPhoneLookup(phone)).toEqual({
        e164: "+12025550123",
        digitCandidates: ["12025550123", "2025550123"],
      })
    })

    it("uses canonical digits only for non-US phones", () => {
      const phone = expectParsedPhone(parseCanonicalPhone("+525512345678"))

      expect(buildExactPhoneLookup(phone)).toEqual({
        e164: "+525512345678",
        digitCandidates: ["525512345678"],
      })
    })
  })
})
