import { describe, expect, it } from "vitest"
import { buildPackagePurchasePayload } from "@/lib/packages"

describe("packages helpers", () => {
  it("returns null when package id is missing", () => {
    const payload = buildPackagePurchasePayload({})
    expect(payload).toBeNull()
  })

  it("builds finite package payload", () => {
    const baseDate = new Date("2026-02-10T12:00:00.000Z")
    const payload = buildPackagePurchasePayload(
      {
        packageId: "morning-3-week",
        packageLabel: "Morning 3-week pack",
        packageTotalCredits: "16",
        packageIsUnlimited: "false",
        packageValidDays: "180",
      },
      baseDate
    )
    expect(payload).not.toBeNull()
    if (!payload) return
    expect(payload.packageId).toBe("morning-3-week")
    expect(payload.totalCredits).toBe(16)
    expect(payload.remainingCredits).toBe(16)
    expect(payload.isUnlimited).toBe(false)
    expect(payload.expiresAt.toISOString()).toBe("2026-08-09T12:00:00.000Z")
  })

  it("builds unlimited package payload when credits are missing", () => {
    const payload = buildPackagePurchasePayload({
      packageId: "morning-monthly",
      packageLabel: "Morning Monthly",
      packageIsUnlimited: "true",
      packageTotalCredits: "",
    })
    expect(payload).not.toBeNull()
    if (!payload) return
    expect(payload.isUnlimited).toBe(true)
    expect(payload.totalCredits).toBeNull()
    expect(payload.remainingCredits).toBeNull()
  })
})
