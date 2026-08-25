import { describe, expect, it } from "vitest"
import {
  SPECIAL_SALSA_CLASS,
  formatSpecialClassDate,
  formatSpecialClassDateTime,
  formatSpecialClassTime,
  getSpecialClassHoldCreatedAt,
  getSpecialClassHoldExpiresAt,
  isSpecialClassPurchaseCounted,
  isSpecialClassPriceCents,
  resolveSpecialClassPricing,
} from "@/lib/special-salsa-class/config"

describe("special salsa class policy", () => {
  it("freezes the approved event and checkout contract", () => {
    expect(SPECIAL_SALSA_CLASS).toMatchObject({
      key: "special-salsa-class-2026-08-30",
      checkoutKind: "special-salsa-class",
      courseSlug: "special-salsa-calena-2026-08-30",
      title: "Special Salsa Caleña Class",
      displayTitle: "Salsa de Cali",
      timeZone: "America/New_York",
      videoSrc: "/videos/SalsaClass.mp4",
      amountCents: 2500,
      promotion: {
        amountCents: 2000,
        discountPercent: 20,
      },
      currency: "usd",
      capacity: 40,
      durationMinutes: 60,
      holdMinutes: 30,
      address: "54 Coles St, Jersey City",
    })
    expect(SPECIAL_SALSA_CLASS.startsAt.toISOString()).toBe("2026-08-30T20:00:00.000Z")
    expect(SPECIAL_SALSA_CLASS.refundDeadline.toISOString()).toBe("2026-08-28T20:00:00.000Z")
    expect(SPECIAL_SALSA_CLASS.promotion.deadline.toISOString()).toBe("2026-08-30T14:00:00.000Z")
  })

  it("switches from the promotional price at the exact deadline", () => {
    expect(resolveSpecialClassPricing(new Date("2026-08-30T13:59:59.999Z"))).toEqual({
      amountCents: 2000,
      discountPercent: 20,
      promotionActive: true,
    })
    expect(resolveSpecialClassPricing(new Date("2026-08-30T14:00:00.000Z"))).toEqual({
      amountCents: 2500,
      discountPercent: 0,
      promotionActive: false,
    })
    expect(resolveSpecialClassPricing(new Date("2026-08-30T14:00:00.001Z"))).toEqual({
      amountCents: 2500,
      discountPercent: 0,
      promotionActive: false,
    })
    expect(isSpecialClassPriceCents(2000)).toBe(true)
    expect(isSpecialClassPriceCents(2500)).toBe(true)
    expect(isSpecialClassPriceCents(1)).toBe(false)
  })

  it("renders local event copy without exposing the internal IANA timezone", () => {
    expect(formatSpecialClassDate(SPECIAL_SALSA_CLASS.startsAt)).toBe("Sunday, August 30, 2026")
    expect(formatSpecialClassTime(SPECIAL_SALSA_CLASS.startsAt)).toBe("4:00 PM")
    expect(formatSpecialClassDateTime(SPECIAL_SALSA_CLASS.startsAt)).toBe(
      "Sunday, August 30, 2026 at 4:00 PM",
    )
    expect(formatSpecialClassDateTime(SPECIAL_SALSA_CLASS.refundDeadline)).toBe(
      "Friday, August 28, 2026 at 4:00 PM",
    )
    expect(formatSpecialClassDateTime(SPECIAL_SALSA_CLASS.startsAt)).not.toContain(SPECIAL_SALSA_CLASS.timeZone)
  })

  it.each(["paid", "succeeded", "completed"])("counts durable %s purchases", (status) => {
    expect(isSpecialClassPurchaseCounted({ status, createdAt: new Date(0) }, new Date())).toBe(true)
  })

  it("counts pending holds only before the exact 30-minute cutoff", () => {
    const now = new Date("2026-08-23T20:30:00.000Z")
    expect(
      isSpecialClassPurchaseCounted(
        { status: "pending", createdAt: new Date("2026-08-23T20:00:00.001Z") },
        now,
      ),
    ).toBe(true)
    expect(
      isSpecialClassPurchaseCounted(
        { status: "pending", createdAt: new Date("2026-08-23T20:00:00.000Z") },
        now,
      ),
    ).toBe(false)
  })

  it("generates one second-precise absolute hold boundary", () => {
    const expiresAt = getSpecialClassHoldExpiresAt(new Date("2026-08-23T20:00:00.987Z"))
    const createdAt = getSpecialClassHoldCreatedAt(expiresAt)

    expect(expiresAt.toISOString()).toBe("2026-08-23T20:30:01.000Z")
    expect(createdAt.toISOString()).toBe("2026-08-23T20:00:01.000Z")
    expect(isSpecialClassPurchaseCounted({ status: "pending", createdAt }, new Date("2026-08-23T20:30:00.999Z"))).toBe(true)
    expect(isSpecialClassPurchaseCounted({ status: "pending", createdAt }, expiresAt)).toBe(false)
  })

  it.each(["failed", "expired", "refunded", "unknown"])("does not count %s purchases", (status) => {
    expect(isSpecialClassPurchaseCounted({ status, createdAt: new Date() }, new Date())).toBe(false)
  })
})
