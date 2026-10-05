import { describe, expect, it } from "vitest"

import {
  getPotentialCoursePromotionLabels,
  normalizeCoursePromotions,
  resolveCoursePromotionPrice,
} from "@/lib/promotions/course-promotions"

const heritagePromotion = {
  id: "heritage-pin-october",
  label: "Heritage pin benefit",
  active: true,
  pricing: { kind: "fixed", amountCents: 1500 },
  window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
  audience: "heritage_pin_delivered",
  channels: ["public_booking", "profile"],
}

const publicPromotion = {
  id: "thanksgiving",
  label: "Thanksgiving week",
  active: true,
  pricing: { kind: "percentage", percentOff: 25 },
  window: { basis: "purchase_date", startDate: "2026-11-20", endDate: "2026-11-30" },
  audience: "everyone",
  channels: ["public_booking"],
}

describe("normalizeCoursePromotions", () => {
  it("normalizes bounded fixed and percentage promotions", () => {
    expect(normalizeCoursePromotions([heritagePromotion, publicPromotion])).toEqual([
      heritagePromotion,
      publicPromotion,
    ])
  })

  it("drops malformed, duplicate, unbounded, and processor-incompatible entries", () => {
    expect(normalizeCoursePromotions([
      heritagePromotion,
      { ...heritagePromotion, label: "Duplicate" },
      { ...heritagePromotion, id: "bad date", window: { ...heritagePromotion.window, endDate: "forever" } },
      { ...heritagePromotion, id: "free", pricing: { kind: "fixed", amountCents: 0 } },
      { ...heritagePromotion, id: "full-discount", pricing: { kind: "percentage", percentOff: 100 } },
      { ...heritagePromotion, id: "unknown-audience", audience: "gold" },
      { ...heritagePromotion, id: "no-channel", channels: [] },
    ])).toEqual([heritagePromotion])
  })

  it("keeps at most twelve valid promotions", () => {
    const promotions = Array.from({ length: 15 }, (_, index) => ({
      ...publicPromotion,
      id: `promotion-${index}`,
    }))

    expect(normalizeCoursePromotions(promotions)).toHaveLength(12)
  })
})

describe("resolveCoursePromotionPrice", () => {
  it("requires delivered Heritage status, eligible class date, and allowed channel", () => {
    const base = {
      promotions: [heritagePromotion],
      channel: "public_booking" as const,
      classDate: "2026-10-08",
      purchaseDate: "2026-09-01",
      regularPriceCents: 2000,
    }

    expect(resolveCoursePromotionPrice({ ...base, hasDeliveredHeritagePin: false })).toEqual({
      applied: false,
      reason: "no_eligible_promotion",
    })
    expect(resolveCoursePromotionPrice({ ...base, hasDeliveredHeritagePin: true })).toMatchObject({
      applied: true,
      amountCents: 1500,
      promotion: { id: "heritage-pin-october" },
    })
    expect(resolveCoursePromotionPrice({ ...base, hasDeliveredHeritagePin: true, classDate: "2026-11-01" })).toMatchObject({ applied: false })
    expect(resolveCoursePromotionPrice({ ...base, hasDeliveredHeritagePin: true, channel: "trusted_kiosk" })).toMatchObject({ applied: false })
  })

  it("uses purchase date and rounds percentage prices to the nearest cent", () => {
    expect(resolveCoursePromotionPrice({
      promotions: [publicPromotion],
      channel: "public_booking",
      classDate: "2027-01-10",
      purchaseDate: "2026-11-24",
      regularPriceCents: 1999,
      hasDeliveredHeritagePin: false,
    })).toMatchObject({ applied: true, amountCents: 1499 })
  })

  it("chooses exactly one lowest eligible promotion", () => {
    const result = resolveCoursePromotionPrice({
      promotions: [
        heritagePromotion,
        { ...heritagePromotion, id: "heritage-10-percent", pricing: { kind: "percentage", percentOff: 10 } },
      ],
      channel: "profile",
      classDate: "2026-10-11",
      purchaseDate: "2026-09-01",
      regularPriceCents: 2000,
      hasDeliveredHeritagePin: true,
    })

    expect(result).toMatchObject({ applied: true, amountCents: 1500, promotion: { id: "heritage-pin-october" } })
  })
})

describe("getPotentialCoursePromotionLabels", () => {
  it("returns date- and channel-applicable labels without asserting audience eligibility", () => {
    expect(getPotentialCoursePromotionLabels({
      promotions: [heritagePromotion],
      channel: "public_booking",
      classDate: "2026-10-04",
      purchaseDate: "2026-09-01",
    })).toEqual(["Heritage pin benefit"])
  })
})
