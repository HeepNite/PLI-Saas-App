import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  resolvePackageOfferScenario,
  buildPackageOfferContext,
  pickEnrollPrefill,
} from "@/lib/checkin/package-offer-integration"

// ─── resolvePackageOfferScenario ──────────────────────────────────

describe("resolvePackageOfferScenario", () => {
  // Deliberately partial bootstrap fixture; individual tests spread and
  // override fields, so keep it loosely typed.
  const baseBootstrap = {
    context: { courseSlug: "salsa", date: "2026-04-20", time: "19:00" },
    package: null,
    quickCheckout: { serviceId: "dropin", packageId: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  it("returns null when not kiosk terminal flow", async () => {
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: false,
      bootstrap: baseBootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: vi.fn(),
    })
    expect(result).toBeNull()
  })

  it("returns null when bootstrap has active package", async () => {
    const bootstrap = { ...baseBootstrap, package: { id: "active" } }
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: vi.fn(),
    })
    expect(result).toBeNull()
  })

  it("returns null when no available packages", async () => {
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap: baseBootstrap,
      availablePackages: [],
      fetchPreviousPackage: vi.fn(),
    })
    expect(result).toBeNull()
  })

  it("returns dropin-upsell without calling fetchPreviousPackage", async () => {
    const fetcher = vi.fn()
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap: baseBootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: fetcher,
    })
    expect(result).toEqual({
      scenario: "dropin-upsell",
      previousPackageId: null,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("returns expired-rebuy from quickCheckoutPackageId without calling fetcher", async () => {
    const fetcher = vi.fn()
    const bootstrap = {
      ...baseBootstrap,
      quickCheckout: { serviceId: "service_1", packageId: "pkg_old" },
    }
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: fetcher,
    })
    expect(result).toEqual({
      scenario: "expired-rebuy",
      previousPackageId: "pkg_old",
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("calls fetchPreviousPackage when no quickCheckoutPackageId and returns expired-rebuy", async () => {
    const fetcher = vi.fn().mockResolvedValue("pkg_prev")
    const bootstrap = {
      ...baseBootstrap,
      quickCheckout: { serviceId: "service_1", packageId: null },
      context: { courseSlug: "salsa", date: "2026-04-20", time: "19:00" },
      customer: { userId: "user_1" },
    }
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: fetcher,
    })
    expect(result).toEqual({
      scenario: "expired-rebuy",
      previousPackageId: "pkg_prev",
    })
    expect(fetcher).toHaveBeenCalledWith({
      userId: "user_1",
      courseSlug: "salsa",
    })
  })

  it("falls back to previousPackageId=null when fetcher fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network error"))
    const bootstrap = {
      ...baseBootstrap,
      quickCheckout: { serviceId: "service_1", packageId: null },
      context: { courseSlug: "salsa", date: "2026-04-20", time: "19:00" },
      customer: { userId: "user_1" },
    }
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: fetcher,
    })
    // Falls back to null previousPackageId — but still expired-rebuy because
    // quickCheckoutServiceId is not "dropin" AND we tried to look up previous
    // Actually: shouldShowPackageOffer with previousPackageId=null and quickCheckoutPackageId=null
    // and quickCheckoutServiceId="service_1" → returns null (no upsell signal)
    expect(result).toBeNull()
  })

  it("returns null when fetcher returns null (no history)", async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    const bootstrap = {
      ...baseBootstrap,
      quickCheckout: { serviceId: "service_1", packageId: null },
      context: { courseSlug: "salsa", date: "2026-04-20", time: "19:00" },
      customer: { userId: "user_1" },
    }
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: fetcher,
    })
    // No quickCheckoutPackageId, no previousPackageId, serviceId != "dropin" → null
    expect(result).toBeNull()
  })

  it("handles null quickCheckout gracefully", async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    const bootstrap = {
      ...baseBootstrap,
      quickCheckout: null,
      customer: { userId: "user_1" },
    }
    const result = await resolvePackageOfferScenario({
      isKioskTerminalFlow: true,
      bootstrap,
      availablePackages: [{ id: "pkg_1" }],
      fetchPreviousPackage: fetcher,
    })
    expect(result).toBeNull()
  })
})

// ─── buildPackageOfferContext ─────────────────────────────────────

describe("buildPackageOfferContext", () => {
  it("builds context from scenario and bootstrap context", () => {
    const ctx = buildPackageOfferContext({
      scenario: "dropin-upsell",
      previousPackageId: null,
      courseSlug: "salsa-nocturno",
      date: "2026-04-20",
      time: "19:00",
    })
    expect(ctx).toEqual({
      scenario: "dropin-upsell",
      previousPackageId: null,
      courseSlug: "salsa-nocturno",
      date: "2026-04-20",
      time: "19:00",
    })
  })

  it("preserves previousPackageId for expired-rebuy", () => {
    const ctx = buildPackageOfferContext({
      scenario: "expired-rebuy",
      previousPackageId: "pkg_old_5",
      courseSlug: "bachata",
      date: "2026-04-21",
      time: "20:00",
    })
    expect(ctx.previousPackageId).toBe("pkg_old_5")
    expect(ctx.scenario).toBe("expired-rebuy")
  })

  it("handles new-user-upsell scenario", () => {
    const ctx = buildPackageOfferContext({
      scenario: "new-user-upsell",
      previousPackageId: null,
      courseSlug: "salsa",
      date: "2026-04-22",
      time: "18:00",
    })
    expect(ctx.scenario).toBe("new-user-upsell")
  })
})

// ─── pickEnrollPrefill ────────────────────────────────────────────

describe("pickEnrollPrefill", () => {
  const quickCheckout = {
    serviceId: "service_1",
    packageId: "pkg_quick",
    addons: ["addon_1"],
    participants: 2,
    coupon: "SAVE10",
    amountCents: 5000,
    currency: "usd",
    sourcePurchaseId: null,
    sourcePurchaseAt: null,
  }

  it("returns packageOfferPrefill when present (priority over quickCheckout)", () => {
    const result = pickEnrollPrefill({
      quickCheckout: quickCheckout,
      selectedPackageId: "pkg_offered",
    })
    expect(result).toEqual({
      service: "service_1",
      packageId: "pkg_offered",
      addons: ["addon_1"],
      participants: 2,
      paymentMethod: "stripe",
    })
  })

  it("returns quickCheckout prefill when no selectedPackageId", () => {
    const result = pickEnrollPrefill({
      quickCheckout: quickCheckout,
      selectedPackageId: null,
    })
    expect(result).toEqual({
      service: "service_1",
      packageId: "pkg_quick",
      addons: ["addon_1"],
      participants: 2,
      paymentMethod: "stripe",
    })
  })

  it("returns undefined when no quickCheckout and no selectedPackageId", () => {
    const result = pickEnrollPrefill({
      quickCheckout: null,
      selectedPackageId: null,
    })
    expect(result).toBeUndefined()
  })

  it("builds minimal prefill when selectedPackageId is set but quickCheckout is null (scenario 3)", () => {
    // New user post-purchase: no quickCheckout history, but they selected a package from the offer
    const result = pickEnrollPrefill({
      quickCheckout: null,
      selectedPackageId: "pkg_offered",
    })
    expect(result).toEqual({
      service: "dropin",
      packageId: "pkg_offered",
      addons: [],
      participants: 1,
      paymentMethod: "stripe",
    })
  })

  it("uses empty string for packageId when quickCheckout has no packageId and no selectedPackageId", () => {
    const qc = { ...quickCheckout, packageId: null }
    const result = pickEnrollPrefill({
      quickCheckout: qc,
      selectedPackageId: null,
    })
    expect(result?.packageId).toBe("")
  })

  it("preserves zero participants and empty addons when quickCheckout has minimal config", () => {
    const qc = { ...quickCheckout, addons: [], participants: 0 }
    const result = pickEnrollPrefill({
      quickCheckout: qc,
      selectedPackageId: null,
    })
    expect(result).toEqual({
      service: "service_1",
      packageId: "pkg_quick",
      addons: [],
      participants: 0,
      paymentMethod: "stripe",
    })
  })

  it("overrides packageId with selectedPackageId even when quickCheckout has empty addons", () => {
    const qc = { ...quickCheckout, addons: [], participants: 0 }
    const result = pickEnrollPrefill({
      quickCheckout: qc,
      selectedPackageId: "pkg_offered",
    })
    expect(result).toEqual({
      service: "service_1",
      packageId: "pkg_offered",
      addons: [],
      participants: 0,
      paymentMethod: "stripe",
    })
  })

  it("still returns undefined when both quickCheckout and selectedPackageId are null", () => {
    const result = pickEnrollPrefill({
      quickCheckout: null,
      selectedPackageId: null,
    })
    expect(result).toBeUndefined()
  })
})
