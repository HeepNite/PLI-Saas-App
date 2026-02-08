import { describe, it, expect } from "vitest"
import { validateCheckoutPayload } from "@/lib/checkout/validation"
import { courseRepository } from "@/lib/courses-repository"

const buildPayload = (overrides: Record<string, unknown> = {}) => {
  const course = courseRepository.getCourseBySlug("salsa-femenina-matutina")
  if (!course) throw new Error("Missing demo course")
  const service = course.enrollment.services[0]
  const pkg = course.enrollment.packages[0]
  const addons = course.enrollment.addons?.slice(0, 1) ?? []

  const participants = 1
  const perPerson =
    (service.price || 0) +
    (pkg?.price || 0) +
    addons.reduce((sum, a) => sum + (a.price || 0), 0)
  const amount = Math.round(perPerson * participants * 100)

  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    amount,
    currency: "usd",
    date: "2026-02-10",
    time: "11:00",
    packageId: pkg?.id || "",
    serviceId: service.id,
    addons: addons.map((a) => a.id),
    participants,
    coupon: "",
    ...overrides,
  }
}

describe("validateCheckoutPayload", () => {
  it("accepts a valid payload", () => {
    const payload = buildPayload()
    const result = validateCheckoutPayload(payload)
    expect("status" in result).toBe(false)
    expect(result.courseSlug).toBe(payload.courseSlug)
    expect(result.amountInt).toBe(payload.amount)
  })

  it("rejects missing slug or amount", () => {
    const result = validateCheckoutPayload({ amount: 0 })
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.status).toBe(400)
    }
  })

  it("rejects invalid service", () => {
    const payload = buildPayload({ serviceId: "invalid-service" })
    const result = validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Invalid service/)
    }
  })

  it("rejects invalid package", () => {
    const payload = buildPayload({ packageId: "invalid-package" })
    const result = validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Invalid package/)
    }
  })

  it("rejects invalid add-ons", () => {
    const payload = buildPayload({ addons: ["invalid-addon"] })
    const result = validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Invalid add-ons/)
    }
  })

  it("rejects amount mismatch", () => {
    const payload = buildPayload({ amount: 123 })
    const result = validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Amount mismatch/)
    }
  })

  it("rejects amount mismatch when participants are changed", () => {
    const payload = buildPayload({ participants: 99 })
    const result = validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Amount mismatch/)
    }
  })
})
