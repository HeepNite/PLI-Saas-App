import { describe, expect, it } from "vitest"
import { EMAIL_REGEX } from "@/lib/shared"

describe("EMAIL_REGEX", () => {
  it("accepts normal addresses and rejects malformed ones", () => {
    expect(EMAIL_REGEX.test("staff@palladiumlatin.art")).toBe(true)
    expect(EMAIL_REGEX.test("a.b@mail.co.uk")).toBe(true)
    expect(EMAIL_REGEX.test("no-tld@domain")).toBe(false)
    expect(EMAIL_REGEX.test("a@b..c")).toBe(false)
    expect(EMAIL_REGEX.test("two@@signs.com")).toBe(false)
  })

  it("rejects an adversarial many-dots input in linear time (no ReDoS)", () => {
    // The old quadratic pattern needed ~1.3s for 50k dots; 200k would take ~20s.
    // A generous bound keeps this deterministic on slow CI runners.
    const input = `a@${".".repeat(200_000)}@`
    const start = performance.now()
    expect(EMAIL_REGEX.test(input)).toBe(false)
    expect(performance.now() - start).toBeLessThan(2_000)
  })
})
