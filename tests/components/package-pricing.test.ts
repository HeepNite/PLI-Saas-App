import { describe, expect, it } from "vitest"
import { formatEnrollmentOptionPrice } from "@/components/front/courses/utils/package-pricing"

describe("formatEnrollmentOptionPrice", () => {
  it("formats package prices that are already expressed in dollars", () => {
    expect(formatEnrollmentOptionPrice(152)).toBe("$152")
    expect(formatEnrollmentOptionPrice(95)).toBe("$95")
  })

  it("keeps cents for fractional prices so the display matches the charge", () => {
    expect(formatEnrollmentOptionPrice(1)).toBe("$1")
    expect(formatEnrollmentOptionPrice(1.5)).toBe("$1.50")
    expect(formatEnrollmentOptionPrice(19.99)).toBe("$19.99")
  })

  it("returns null for missing or invalid prices", () => {
    expect(formatEnrollmentOptionPrice(null)).toBeNull()
    expect(formatEnrollmentOptionPrice(undefined)).toBeNull()
    expect(formatEnrollmentOptionPrice(Number.NaN)).toBeNull()
  })
})
