import { describe, expect, it } from "vitest"
import {
  HERITAGE_PIN_CAMPAIGN_KEY,
  buildDeliveredHeritagePinMetadata,
  buildPendingHeritagePinMetadata,
  getHeritagePinCampaignConfig,
  getHeritagePinDateKey,
  isHeritagePinAcquisitionDate,
  isHeritagePinBenefitClassDate,
  normalizeHeritagePinCountryCode,
  parseHeritagePinEntitlement,
  resolveHeritagePinAwardCountry,
  selectHeritagePinEntitlement,
} from "@/lib/campaigns/heritage-pin"
import { buildHeritagePinEntitlementsByUser } from "@/lib/campaigns/heritage-pin-entitlement"

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

  it("admits only a valid public-booking award intent settled inside the acquisition window", () => {
    expect(resolveHeritagePinAwardCountry({
      heritagePinIntent: HERITAGE_PIN_CAMPAIGN_KEY,
      heritagePinCountryCode: "co",
      heritagePinSource: "public_booking",
    }, new Date("2026-10-05T14:00:00.000Z"))).toBe("CO")
    expect(resolveHeritagePinAwardCountry({
      heritagePinIntent: HERITAGE_PIN_CAMPAIGN_KEY,
      heritagePinCountryCode: "CO",
      heritagePinSource: "public_booking",
    }, new Date("2026-11-05T14:00:00.000Z"))).toBeNull()
    expect(resolveHeritagePinAwardCountry({
      heritagePinIntent: HERITAGE_PIN_CAMPAIGN_KEY,
      heritagePinCountryCode: "CO",
      heritagePinSource: "kiosk",
    }, new Date("2026-10-05T14:00:00.000Z"))).toBeNull()
  })

  it("builds pending metadata without clobbering unrelated purchase fields", () => {
    expect(buildPendingHeritagePinMetadata(
      { paymentChannel: "card", stripeFailure: { code: "old" } },
      { countryCode: "mx", earnedAt: new Date("2026-10-05T14:00:00.000Z") },
    )).toMatchObject({
      paymentChannel: "card",
      stripeFailure: { code: "old" },
      heritagePinCampaign: HERITAGE_PIN_CAMPAIGN_KEY,
      heritagePinCountryCode: "MX",
      heritagePinStatus: "pending",
      heritagePinSource: "public_booking",
    })
  })

  it("marks a pending entitlement delivered while preserving metadata", () => {
    const pending = buildPendingHeritagePinMetadata(
      { paymentChannel: "card" },
      { countryCode: "AR", earnedAt: new Date("2026-10-02T14:00:00.000Z") },
    )
    const delivered = buildDeliveredHeritagePinMetadata(pending, {
      deliveredAt: new Date("2026-10-04T21:00:00.000Z"),
      deliveredBy: "staff_123",
    })
    expect(delivered).toMatchObject({
      paymentChannel: "card",
      heritagePinStatus: "delivered",
      heritagePinDeliveredBy: "staff_123",
      heritagePinDeliveredAt: "2026-10-04T21:00:00.000Z",
    })
  })

  it("fails closed for malformed delivered metadata", () => {
    expect(parseHeritagePinEntitlement({
      id: "purchase_bad",
      metadata: {
        heritagePinCampaign: HERITAGE_PIN_CAMPAIGN_KEY,
        heritagePinCountryCode: "CO",
        heritagePinStatus: "delivered",
        heritagePinEarnedAt: "2026-10-02T14:00:00.000Z",
        heritagePinSource: "public_booking",
      },
    })).toBeNull()
  })

  it("selects a delivered entitlement over duplicate pending metadata", () => {
    const pending = buildPendingHeritagePinMetadata({}, {
      countryCode: "CO",
      earnedAt: new Date("2026-10-01T14:00:00.000Z"),
    })
    const delivered = buildDeliveredHeritagePinMetadata(pending, {
      deliveredAt: new Date("2026-10-03T14:00:00.000Z"),
      deliveredBy: "staff_1",
    })
    expect(selectHeritagePinEntitlement([
      { id: "pending-copy", metadata: pending },
      { id: "source", metadata: delivered },
    ])).toMatchObject({ sourcePurchaseId: "source", status: "delivered", countryCode: "CO" })
  })

  it("builds one resolved entitlement per user", () => {
    const metadata = buildPendingHeritagePinMetadata({}, {
      countryCode: "DO",
      earnedAt: new Date("2026-10-01T14:00:00.000Z"),
    })
    expect(buildHeritagePinEntitlementsByUser([
      { id: "p1", userId: "u1", metadata, createdAt: "2026-10-01T14:00:00.000Z" },
      { id: "p2", userId: "u2", metadata: {}, createdAt: "2026-10-01T14:00:00.000Z" },
    ]).get("u1")).toMatchObject({ countryCode: "DO", status: "pending" })
  })
})
