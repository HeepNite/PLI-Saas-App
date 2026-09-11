import { describe, expect, it } from "vitest"
import { isRaffleSlug } from "@/lib/raffle/slug"

describe("isRaffleSlug", () => {
  it("accepts lowercase letters, digits, and hyphens", () => {
    expect(isRaffleSlug("ple-launch-2026-09-12")).toBe(true)
    expect(isRaffleSlug("a")).toBe(true)
    expect(isRaffleSlug("a".repeat(64))).toBe(true)
  })

  it("rejects uppercase, whitespace, and other separators", () => {
    expect(isRaffleSlug("Ple-Launch")).toBe(false)
    expect(isRaffleSlug("ple launch")).toBe(false)
    expect(isRaffleSlug("ple_launch")).toBe(false)
    expect(isRaffleSlug("")).toBe(false)
  })

  it("rejects a slug longer than 64 characters", () => {
    expect(isRaffleSlug("a".repeat(65))).toBe(false)
  })
})
