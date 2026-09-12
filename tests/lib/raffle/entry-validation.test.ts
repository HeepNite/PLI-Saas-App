import { describe, expect, it } from "vitest"
import { parseRaffleEntryInput } from "@/lib/raffle/entry-validation"

describe("parseRaffleEntryInput", () => {
  it("accepts a valid name and phone, defaulting country to US", () => {
    const result = parseRaffleEntryInput({ name: "Ana Lopez", phone: "2125551234" })
    expect(result).toEqual({
      ok: true,
      value: { name: "Ana Lopez", phoneE164: "+12125551234", phoneCountry: "US" },
    })
  })

  it("trims the name", () => {
    const result = parseRaffleEntryInput({ name: "  Ana  ", phone: "2125551234" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe("Ana")
  })

  it("honours an explicit country", () => {
    const result = parseRaffleEntryInput({ name: "Ana Lopez", phone: "5512345678", country: "MX" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.phoneCountry).toBe("MX")
      expect(result.value.phoneE164).toBe("+525512345678")
    }
  })

  it("rejects a non-object body", () => {
    expect(parseRaffleEntryInput("nope")).toEqual({ ok: false, status: "invalid_body" })
    expect(parseRaffleEntryInput(null)).toEqual({ ok: false, status: "invalid_body" })
    expect(parseRaffleEntryInput([])).toEqual({ ok: false, status: "invalid_body" })
    expect(parseRaffleEntryInput(undefined)).toEqual({ ok: false, status: "invalid_body" })
  })

  it("rejects when name or phone are missing or not strings", () => {
    expect(parseRaffleEntryInput({ phone: "2125551234" })).toEqual({ ok: false, status: "invalid_body" })
    expect(parseRaffleEntryInput({ name: "Ana Lopez" })).toEqual({ ok: false, status: "invalid_body" })
    expect(parseRaffleEntryInput({ name: "Ana Lopez", phone: 2125551234 })).toEqual({
      ok: false,
      status: "invalid_body",
    })
    expect(parseRaffleEntryInput({ name: "Ana Lopez", phone: "2125551234", country: 1 })).toEqual({
      ok: false,
      status: "invalid_body",
    })
  })

  it("rejects a name shorter than 2 characters (1 char)", () => {
    expect(parseRaffleEntryInput({ name: "A", phone: "2125551234" })).toEqual({
      ok: false,
      status: "invalid_name",
    })
  })

  it("rejects a name longer than 60 characters (61 chars)", () => {
    expect(parseRaffleEntryInput({ name: "A".repeat(61), phone: "2125551234" })).toEqual({
      ok: false,
      status: "invalid_name",
    })
  })

  it("accepts a name at the 2 and 60 character boundaries", () => {
    expect(parseRaffleEntryInput({ name: "Al", phone: "2125551234" }).ok).toBe(true)
    expect(parseRaffleEntryInput({ name: "A".repeat(60), phone: "2125551234" }).ok).toBe(true)
  })

  it("rejects a name that is all digits", () => {
    expect(parseRaffleEntryInput({ name: "12345", phone: "2125551234" })).toEqual({
      ok: false,
      status: "invalid_name",
    })
  })

  it("rejects an unparsable phone", () => {
    expect(parseRaffleEntryInput({ name: "Ana Lopez", phone: "123" })).toEqual({
      ok: false,
      status: "invalid_phone",
    })
  })

  it("rejects a phone that does not match an unsupported country code", () => {
    expect(parseRaffleEntryInput({ name: "Ana Lopez", phone: "2125551234", country: "ZZ" })).toEqual({
      ok: false,
      status: "invalid_phone",
    })
  })
})
