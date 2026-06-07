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
  const serviceCharge = pkg ? 0 : service.price || 0
  const perPerson =
    serviceCharge +
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
  it("accepts a valid payload", async () => {
    const payload = buildPayload()
    const result = await validateCheckoutPayload(payload)
    expect("status" in result).toBe(false)
    if ("status" in result) {
      throw new Error(`Expected valid payload, got error: ${result.error}`)
    }
    expect(result.courseSlug).toBe(payload.courseSlug)
    expect(result.amountInt).toBe(payload.amount)
  })

  it("rejects missing slug or amount", async () => {
    const result = await validateCheckoutPayload({ amount: 0 })
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.status).toBe(400)
    }
  })

  it("rejects invalid service", async () => {
    const payload = buildPayload({ serviceId: "invalid-service" })
    const result = await validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Invalid service/)
    }
  })

  it("rejects invalid package", async () => {
    const payload = buildPayload({ packageId: "invalid-package" })
    const result = await validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Invalid package/)
    }
  })

  it("rejects invalid add-ons", async () => {
    const payload = buildPayload({ addons: ["invalid-addon"] })
    const result = await validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Invalid add-ons/)
    }
  })

  it("rejects amount mismatch", async () => {
    const payload = buildPayload({ amount: 123 })
    const result = await validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Amount mismatch/)
    }
  })

  it("rejects amount mismatch when participants are changed", async () => {
    const payload = buildPayload({ participants: 99 })
    const result = await validateCheckoutPayload(payload)
    expect("status" in result).toBe(true)
    if ("status" in result) {
      expect(result.error).toMatch(/Amount mismatch/)
    }
  })
})
