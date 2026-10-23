import { describe, expect, it } from "vitest"

import { resolveCourseDisplayPrices } from "@/lib/promotions/course-display-prices"

const services = [
  { id: "dropin", label: "Single class", price: 1 },
  { id: "new-student", label: "New students", price: 1 },
]

const kioskPromotion = {
  id: "kiosk-october",
  label: "October special",
  active: true,
  pricing: { kind: "fixed", amountCents: 50 },
  window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
  audience: "everyone",
  channels: ["trusted_kiosk"],
}

describe("resolveCourseDisplayPrices", () => {
  it("returns the drop-in and first-class prices of the charged services", () => {
    expect(resolveCourseDisplayPrices({ services, promotions: [], channel: "trusted_kiosk", classDate: "2026-10-23", purchaseDate: "2026-10-23" }))
      .toEqual({ dropIn: 1, firstClass: 1, promotionLabel: null })
  })

  it("returns null prices when the services are missing instead of inventing one", () => {
    expect(resolveCourseDisplayPrices({ services: [], promotions: [], channel: null, classDate: "2026-10-23", purchaseDate: "2026-10-23" }))
      .toEqual({ dropIn: null, firstClass: null, promotionLabel: null })
  })

  it("applies the checkout promotion resolution on the channel where checkout applies it", () => {
    const priced = [
      { id: "dropin", label: "Single class", price: 20 },
      { id: "new-student", label: "New students", price: 15 },
    ]
    expect(resolveCourseDisplayPrices({ services: priced, promotions: [kioskPromotion], channel: "trusted_kiosk", classDate: "2026-10-23", purchaseDate: "2026-10-23" }))
      .toEqual({ dropIn: 0.5, firstClass: 0.5, promotionLabel: "October special" })
  })

  it("keeps list prices when the channel has no promotion (checkout would not apply it)", () => {
    const priced = [
      { id: "dropin", label: "Single class", price: 20 },
      { id: "new-student", label: "New students", price: 15 },
    ]
    expect(resolveCourseDisplayPrices({ services: priced, promotions: [kioskPromotion], channel: null, classDate: "2026-10-23", purchaseDate: "2026-10-23" }))
      .toEqual({ dropIn: 20, firstClass: 15, promotionLabel: null })
  })

  it("only lowers the first-class price when the promotion is cheaper than it", () => {
    const priced = [
      { id: "dropin", label: "Single class", price: 20 },
      { id: "new-student", label: "New students", price: 10 },
    ]
    const promo = { ...kioskPromotion, pricing: { kind: "fixed", amountCents: 1200 } }
    expect(resolveCourseDisplayPrices({ services: priced, promotions: [promo], channel: "trusted_kiosk", classDate: "2026-10-23", purchaseDate: "2026-10-23" }))
      .toEqual({ dropIn: 12, firstClass: 10, promotionLabel: "October special" })
  })
})
