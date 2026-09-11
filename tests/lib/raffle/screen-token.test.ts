import { describe, expect, it } from "vitest"
import {
  generateScreenToken,
  hashScreenToken,
  screenCookieName,
  screenTokenMatches,
} from "@/lib/raffle/screen-token"

describe("hashScreenToken / screenTokenMatches", () => {
  it("accepts the correct raw token", () => {
    const raw = generateScreenToken()
    const hash = hashScreenToken(raw)

    expect(screenTokenMatches(raw, hash)).toBe(true)
  })

  it("rejects a wrong token whose hash is the same length (64 hex chars)", () => {
    const raw = generateScreenToken()
    const hash = hashScreenToken(raw)
    const wrongHash = hashScreenToken("a-completely-different-token")

    expect(wrongHash).toHaveLength(64)
    expect(hash).toHaveLength(64)
    expect(screenTokenMatches(raw, wrongHash)).toBe(false)
  })

  it("rejects a stored hash of unequal length without throwing", () => {
    const raw = generateScreenToken()

    expect(() => screenTokenMatches(raw, "deadbeef")).not.toThrow()
    expect(screenTokenMatches(raw, "deadbeef")).toBe(false)
  })

  it("generates a fresh token on every call", () => {
    expect(generateScreenToken()).not.toBe(generateScreenToken())
  })
})

describe("screenCookieName", () => {
  it("scopes the cookie name to the event slug", () => {
    expect(screenCookieName("ple-launch-2026-09-12")).toBe("pli_raffle_screen_ple-launch-2026-09-12")
  })
})
