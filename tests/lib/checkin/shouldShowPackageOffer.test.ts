import { describe, expect, it } from "vitest"
import {
  shouldShowPackageOffer,
  shouldPreserveOfferOnBootstrapClear,
  resolvePackageOfferDeclineAction,
} from "@/lib/checkin/existing-customer-flow"

const buildInput = (
  overrides: Partial<Parameters<typeof shouldShowPackageOffer>[0]> = {}
): Parameters<typeof shouldShowPackageOffer>[0] => ({
  isKioskTerminalFlow: true,
  hasPackage: false,
  quickCheckoutServiceId: "dropin",
  quickCheckoutPackageId: null,
  previousPackageId: null,
  availablePackages: [{ id: "pkg_10" }],
  ...overrides,
})

describe("shouldShowPackageOffer", () => {
  it("returns null when not a kiosk terminal flow", () => {
    expect(shouldShowPackageOffer(buildInput({ isKioskTerminalFlow: false }))).toBeNull()
  })

  it("returns null when customer has an active package", () => {
    expect(shouldShowPackageOffer(buildInput({ hasPackage: true }))).toBeNull()
  })

  it("returns null when course has no available packages", () => {
    expect(shouldShowPackageOffer(buildInput({ availablePackages: [] }))).toBeNull()
  })

  it("returns 'expired-rebuy' when previousPackageId is present", () => {
    expect(
      shouldShowPackageOffer(
        buildInput({
          previousPackageId: "pkg_old_5",
          quickCheckoutServiceId: "service_1",
          quickCheckoutPackageId: null,
        })
      )
    ).toBe("expired-rebuy")
  })

  it("returns 'expired-rebuy' when quickCheckoutPackageId is present", () => {
    expect(
      shouldShowPackageOffer(
        buildInput({
          previousPackageId: null,
          quickCheckoutPackageId: "pkg_quick",
          quickCheckoutServiceId: "service_1",
        })
      )
    ).toBe("expired-rebuy")
  })

  it("returns 'dropin-upsell' when serviceId is dropin and no previous/expired package", () => {
    expect(
      shouldShowPackageOffer(
        buildInput({
          quickCheckoutServiceId: "dropin",
          quickCheckoutPackageId: null,
          previousPackageId: null,
        })
      )
    ).toBe("dropin-upsell")
  })

  it("returns null for first-time existing customer with no upsell signals", () => {
    expect(
      shouldShowPackageOffer(
        buildInput({
          quickCheckoutServiceId: "service_1",
          quickCheckoutPackageId: null,
          previousPackageId: null,
        })
      )
    ).toBeNull()
  })

  it("prioritizes expired-rebuy over dropin-upsell when both signals exist", () => {
    expect(
      shouldShowPackageOffer(
        buildInput({
          quickCheckoutServiceId: "dropin",
          quickCheckoutPackageId: "pkg_previous",
          previousPackageId: null,
        })
      )
    ).toBe("expired-rebuy")
  })

  it("returns null when quickCheckoutServiceId is null and no expired signal", () => {
    expect(
      shouldShowPackageOffer(
        buildInput({
          quickCheckoutServiceId: null,
          quickCheckoutPackageId: null,
          previousPackageId: null,
        })
      )
    ).toBeNull()
  })
})

// ─── shouldPreserveOfferOnBootstrapClear ───────────────────────────

describe("shouldPreserveOfferOnBootstrapClear", () => {
  it("returns true for new-user-upsell (offer must survive bootstrap clear)", () => {
    expect(shouldPreserveOfferOnBootstrapClear("new-user-upsell")).toBe(true)
  })

  it("returns false for expired-rebuy", () => {
    expect(shouldPreserveOfferOnBootstrapClear("expired-rebuy")).toBe(false)
  })

  it("returns false for dropin-upsell", () => {
    expect(shouldPreserveOfferOnBootstrapClear("dropin-upsell")).toBe(false)
  })

  it("returns false when scenario is null", () => {
    expect(shouldPreserveOfferOnBootstrapClear(null)).toBe(false)
  })
})

// ─── resolvePackageOfferDeclineAction ──────────────────────────────

describe("resolvePackageOfferDeclineAction", () => {
  it("returns 'station-completion' for new-user-upsell", () => {
    expect(resolvePackageOfferDeclineAction("new-user-upsell")).toBe("station-completion")
  })

  it("returns 'existing-purchase' for expired-rebuy", () => {
    expect(resolvePackageOfferDeclineAction("expired-rebuy")).toBe("existing-purchase")
  })

  it("returns 'existing-purchase' for dropin-upsell", () => {
    expect(resolvePackageOfferDeclineAction("dropin-upsell")).toBe("existing-purchase")
  })

  it("returns 'existing-purchase' when scenario is null", () => {
    expect(resolvePackageOfferDeclineAction(null)).toBe("existing-purchase")
  })
})
