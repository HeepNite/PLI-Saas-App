import { describe, expect, it } from "vitest"
import {
  HERITAGE_PIN_CAMPAIGN_KEY,
  getHeritagePinCampaignConfig,
  getHeritagePinDateKey,
  isHeritagePinAcquisitionDate,
  isHeritagePinBenefitClassDate,
  normalizeHeritagePinCountryCode,
  resolveHeritagePinPrice,
} from "@/lib/campaigns/heritage-pin"

describe("Heritage Pin campaign", () => {
  it("uses bounded defaults and accepts a safe first-week-of-November extension", () => {
    expect(getHeritagePinCampaignConfig({})).toEqual({
      acquisitionStart: "2026-10-01",
      acquisitionEnd: "2026-10-31",
      benefitStart: "2026-10-01",
      benefitEnd: "2026-10-31",
    })
    expect(getHeritagePinCampaignConfig({
      HERITAGE_PIN_ACQUISITION_END: "2026-11-07",
      HERITAGE_PIN_BENEFIT_END: "2026-11-07",
    })).toMatchObject({
      acquisitionEnd: "2026-11-07",
      benefitEnd: "2026-11-07",
    })
  })

  it("rejects malformed, reversed, and unbounded date overrides", () => {
    expect(getHeritagePinCampaignConfig({
      HERITAGE_PIN_ACQUISITION_START: "nope",
      HERITAGE_PIN_ACQUISITION_END: "2099-12-31",
      HERITAGE_PIN_BENEFIT_START: "2026-11-15",
      HERITAGE_PIN_BENEFIT_END: "2026-11-01",
    })).toEqual({
      acquisitionStart: "2026-10-01",
      acquisitionEnd: "2026-10-31",
      benefitStart: "2026-10-01",
      benefitEnd: "2026-10-31",
    })
  })

  it("uses New York calendar time for acquisition boundaries", () => {
    expect(getHeritagePinDateKey(new Date("2026-10-01T03:30:00.000Z"))).toBe("2026-09-30")
    expect(getHeritagePinDateKey(new Date("2026-10-01T04:30:00.000Z"))).toBe("2026-10-01")
    expect(isHeritagePinAcquisitionDate(new Date("2026-10-01T04:30:00.000Z"))).toBe(true)
    expect(isHeritagePinAcquisitionDate(new Date("2026-11-01T04:30:00.000Z"))).toBe(false)
  })

  it("limits the benefit to Sunday and Monday dates inside the configured window", () => {
    expect(isHeritagePinBenefitClassDate("2026-10-04")).toBe(true)
    expect(isHeritagePinBenefitClassDate("2026-10-05")).toBe(true)
    expect(isHeritagePinBenefitClassDate("2026-10-06")).toBe(false)
    expect(isHeritagePinBenefitClassDate("2026-11-02")).toBe(false)
    expect(isHeritagePinBenefitClassDate("2026-11-02", {
      ...getHeritagePinCampaignConfig({}),
      benefitEnd: "2026-11-07",
    })).toBe(true)
  })

  it("normalizes only real ISO country codes", () => {
    expect(normalizeHeritagePinCountryCode(" co ")).toBe("CO")
    expect(normalizeHeritagePinCountryCode("PR")).toBe("PR")
    expect(normalizeHeritagePinCountryCode("ZZ")).toBeNull()
  })

  it("applies the fixed price only to a delivered holder's non-stacked Sunday or Monday drop-in", () => {
    const delivered = {
      campaign: HERITAGE_PIN_CAMPAIGN_KEY,
      sourcePurchaseId: "source",
      countryCode: "CO",
      countryName: "Colombia",
      status: "delivered" as const,
      earnedAt: "2026-10-01T12:00:00.000Z",
      deliveredAt: "2026-10-02T12:00:00.000Z",
      deliveredBy: "staff_1",
      source: "public_booking" as const,
    }
    const base = {
      entitlement: delivered,
      classDate: "2026-10-04",
      participants: 1,
      serviceId: "dropin",
      packageId: "",
      coupon: "",
      addonCount: 0,
      consecutivePriceCents: null,
      consecutiveAddOnOnly: false,
    }

    expect(resolveHeritagePinPrice(base)).toMatchObject({ applied: true, amountCents: 1500 })
    expect(resolveHeritagePinPrice({ ...base, classDate: "2026-10-06" })).toMatchObject({ applied: false, reason: "date_ineligible" })
    expect(resolveHeritagePinPrice({ ...base, entitlement: { ...delivered, status: "pending" } })).toMatchObject({ applied: false, reason: "pin_pending" })
    expect(resolveHeritagePinPrice({ ...base, coupon: "PLI10" })).toMatchObject({ applied: false, reason: "promotion_conflict" })
    expect(resolveHeritagePinPrice({ ...base, packageId: "pack" })).toMatchObject({ applied: false, reason: "not_single_drop_in" })
    expect(resolveHeritagePinPrice({ ...base, serviceId: "new-student" })).toMatchObject({ applied: false, reason: "promotion_conflict" })
    expect(resolveHeritagePinPrice({ ...base, participants: 2 })).toMatchObject({ applied: false, reason: "not_single_drop_in" })
  })

})
