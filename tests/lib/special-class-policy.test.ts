import { describe, expect, it } from "vitest"
import {
  SPECIAL_CLASS_HOLD_MS,
  canManageSpecialClassDefinition,
  canOperateSpecialClassRoster,
  canTransitionSpecialClass,
  isCountedSpecialClassPurchase,
  isPublishableSpecialClass,
} from "@/lib/special-classes/policy"

describe("special class policy", () => {
  it("counts paid purchases and only unexpired pending holds", () => {
    const now = new Date("2026-08-26T12:00:00.000Z")

    expect(isCountedSpecialClassPurchase({ status: "paid", holdExpiresAt: null }, now)).toBe(true)
    expect(isCountedSpecialClassPurchase({ status: "pending", holdExpiresAt: new Date(now.getTime() + 1) }, now)).toBe(true)
    expect(isCountedSpecialClassPurchase({ status: "pending", holdExpiresAt: now }, now)).toBe(false)
    expect(isCountedSpecialClassPurchase({ status: "expired", holdExpiresAt: new Date(now.getTime() + 1) }, now)).toBe(false)
  })

  it("limits every admitted hold to three minutes", () => {
    expect(SPECIAL_CLASS_HOLD_MS).toBe(3 * 60_000)
  })

  it("permits roster operations for owner, admin, and front desk only", () => {
    expect(canOperateSpecialClassRoster("owner", "partner")).toBe(true)
    expect(canOperateSpecialClassRoster("admin", "manager")).toBe(true)
    expect(canOperateSpecialClassRoster("staff", "front_desk")).toBe(true)
    expect(canOperateSpecialClassRoster("staff", "guest", "teacher")).toBe(false)
    expect(canOperateSpecialClassRoster(undefined, undefined)).toBe(false)
    expect(canManageSpecialClassDefinition("staff", "front_desk")).toBe(false)
  })

  it("requires valid commercial fields and a future session before publication", () => {
    const now = new Date("2026-08-26T12:00:00.000Z")
    expect(isPublishableSpecialClass({ startsAt: new Date("2026-08-26T12:01:00.000Z"), capacity: 1, title: "Class", description: "Description", currency: "usd", priceCents: 1 }, now)).toBe(true)
    expect(isPublishableSpecialClass({ startsAt: now, capacity: 1, title: "Class", description: "Description", currency: "usd", priceCents: 1 }, now)).toBe(false)
  })

  it("allows only the defined special-class lifecycle transitions", () => {
    expect(canTransitionSpecialClass("draft", "published")).toBe(true)
    expect(canTransitionSpecialClass("draft", "closed")).toBe(false)
    expect(canTransitionSpecialClass("published", "closed")).toBe(true)
    expect(canTransitionSpecialClass("published", "cancelled")).toBe(true)
    expect(canTransitionSpecialClass("closed", "published")).toBe(false)
    expect(canTransitionSpecialClass("cancelled", "published")).toBe(false)
  })
})
