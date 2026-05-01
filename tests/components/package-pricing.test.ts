import { describe, expect, it } from "vitest"
import { formatEnrollmentOptionPrice } from "@/components/front/courses/utils/package-pricing"

describe("formatEnrollmentOptionPrice", () => {
  it("formats package prices that are already expressed in dollars", () => {
    expect(formatEnrollmentOptionPrice(152)).toBe("$152")
    expect(formatEnrollmentOptionPrice(95)).toBe("$95")
  })

  it("returns null for missing or invalid prices", () => {
    expect(formatEnrollmentOptionPrice(null)).toBeNull()
    expect(formatEnrollmentOptionPrice(undefined)).toBeNull()
    expect(formatEnrollmentOptionPrice(Number.NaN)).toBeNull()
  })
})
