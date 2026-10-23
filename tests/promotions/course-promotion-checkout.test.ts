import { describe, expect, it } from "vitest"

import { resolveCoursePromotionCheckoutAmount } from "@/lib/promotions/course-promotion-checkout"

const kioskPromotion = {
  id: "kiosk-october",
  label: "October special",
  active: true,
  pricing: { kind: "fixed", amountCents: 1000 },
  window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
  audience: "everyone",
  channels: ["trusted_kiosk"],
}

const course = {
  slug: "salsa",
  title: "Salsa",
  schedule: { day: "Friday", time: "19:00", starts: "2026-01-01", availableWeekdays: [4], availableTimes: ["19:00"] },
}

const shape = {
  serviceId: "dropin",
  safeParticipants: 1,
  packageId: "",
  coupon: "",
  addons: [] as string[],
  consecutivePriceCents: null,
  consecutiveAddOnOnly: false,
}

const base = {
  trustedChannel: "trusted_kiosk" as const,
  authoritativePromotions: [kioskPromotion],
  authoritativeCourse: course,
  classDate: "2026-10-23",
  classTime: "19:00",
  purchaseDate: "2026-10-23",
  amountCents: 2000,
  regularPriceCents: 2000,
  checkoutShape: shape,
  hasDeliveredHeritagePin: false,
}

describe("resolveCoursePromotionCheckoutAmount", () => {
  it("charges the promotional amount for an eligible single drop-in on the kiosk", () => {
    const result = resolveCoursePromotionCheckoutAmount(base)
    expect(result.effectiveAmountCents).toBe(1000)
    expect(result.appliedPromotion?.promotion.label).toBe("October special")
  })

  it("keeps the list amount for packages, coupons, add-ons, several participants or no channel", () => {
    for (const override of [
      { checkoutShape: { ...shape, packageId: "pkg-4" } },
      { checkoutShape: { ...shape, coupon: "SAVE" } },
      { checkoutShape: { ...shape, addons: ["shoes"] } },
      { checkoutShape: { ...shape, safeParticipants: 2 } },
      { trustedChannel: null },
    ]) {
      expect(resolveCoursePromotionCheckoutAmount({ ...base, ...override }).effectiveAmountCents).toBe(2000)
    }
  })

  it("requires a scheduled occurrence for class-date promotions", () => {
    expect(resolveCoursePromotionCheckoutAmount({ ...base, classTime: "21:00" }).effectiveAmountCents).toBe(2000)
  })

  it("applies heritage-only promotions only when the pin is delivered", () => {
    const heritage = { ...kioskPromotion, audience: "heritage_pin_delivered" }
    expect(resolveCoursePromotionCheckoutAmount({ ...base, authoritativePromotions: [heritage] }).effectiveAmountCents).toBe(2000)
    expect(resolveCoursePromotionCheckoutAmount({ ...base, authoritativePromotions: [heritage], hasDeliveredHeritagePin: true }).effectiveAmountCents).toBe(1000)
  })
})
