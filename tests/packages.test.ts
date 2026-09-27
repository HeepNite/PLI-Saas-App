import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    packagePurchase: { findUnique: vi.fn(), create: vi.fn() },
    packagePlan: { findUniqueOrThrow: vi.fn(), upsert: vi.fn() },
    purchase: { updateMany: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  buildPackagePurchasePayload,
  reservePackageCreditForAttendanceTx,
  revokeUnusedInternalPackagePurchaseTx,
  syncPackagePurchaseFromPaidPurchase,
} from "@/lib/packages"

describe("packages helpers", () => {
  beforeEach(() => {
    mockPrisma.packagePurchase.findUnique.mockReset()
    mockPrisma.packagePurchase.create.mockReset()
    mockPrisma.packagePlan.findUniqueOrThrow.mockReset()
    mockPrisma.packagePlan.upsert.mockReset()
  })

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

  it("builds the internal sale as exactly one finite general class credit", () => {
    const payload = buildPackagePurchasePayload({
      packageId: "pli-internal-general-class-credit-v1",
      packageLabel: "General class credit",
      packageTotalCredits: "1",
      packageIsUnlimited: "false",
      packageValidDays: "180",
    })
    expect(payload).toMatchObject({
      packageId: "pli-internal-general-class-credit-v1",
      totalCredits: 1,
      remainingCredits: 1,
      isUnlimited: false,
    })
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

  it("reuses an existing package usage for the same attendance without decrementing again", async () => {
    const existingUsage = {
      id: "usage_existing",
      packagePurchaseId: "package_purchase_1",
      attendanceId: "attendance_1",
      delta: -1,
    }
    const linkedPackage = {
      id: "package_purchase_1",
      userId: "user_1",
      remainingCredits: 4,
    }
    const tx = {
      packageUsageLedger: {
        findUnique: vi.fn().mockResolvedValue(existingUsage),
        create: vi.fn(),
      },
      packagePurchase: {
        findUnique: vi.fn().mockResolvedValue(linkedPackage),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    }

    const result = await reservePackageCreditForAttendanceTx(tx as never, {
      packagePurchaseId: "package_purchase_1",
      userId: "user_1",
      attendanceId: "attendance_1",
      courseSlug: "salsa-beginner",
      at: new Date("2026-06-19T23:30:00.000Z"),
      reason: "STAFF_FAST_SIGN_IN",
    })

    expect(result).toMatchObject({
      packagePurchase: linkedPackage,
      usage: existingUsage,
      consumed: true,
    })
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.create).not.toHaveBeenCalled()
  })

  it("reuses the materialized purchase after a concurrent purchase-id create conflict", async () => {
    const replayed = { id: "package_purchase_1", purchaseId: "purchase_1" }
    mockPrisma.packagePurchase.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(replayed)
    mockPrisma.packagePurchase.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "test" })
    )
    mockPrisma.packagePlan.findUniqueOrThrow.mockResolvedValue({ id: "plan_1" })

    const result = await syncPackagePurchaseFromPaidPurchase({
      userId: "user_1", purchaseId: "purchase_1", packagePlanId: "plan_1", source: "cash",
      metadata: { packageId: "current-plan" },
    })

    expect(result).toBe(replayed)
    expect(mockPrisma.packagePurchase.create).toHaveBeenCalledTimes(1)
  })

  it("recovers a concurrent package-purchase create on a fresh client after its transaction is aborted", async () => {
    const replayed = { id: "package_purchase_1", purchaseId: "purchase_1" }
    const tx = {
      packagePurchase: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("transaction is aborted")),
        create: vi.fn().mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "test" })
        ),
      },
      packagePlan: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "plan_1" }), upsert: vi.fn() },
    }
    mockPrisma.packagePurchase.findUnique.mockResolvedValueOnce(replayed)

    await expect(syncPackagePurchaseFromPaidPurchase({
      userId: "user_1", purchaseId: "purchase_1", packagePlanId: "plan_1", tx: tx as never,
      metadata: { packageId: "current-plan" },
    })).resolves.toBe(replayed)
    expect(tx.packagePurchase.findUnique).toHaveBeenCalledTimes(1)
    expect(mockPrisma.packagePurchase.findUnique).toHaveBeenCalledWith({ where: { purchaseId: "purchase_1" } })
  })

  it("does not regrant a revoked package when its paid event is replayed", async () => {
    const revoked = { id: "package_purchase_1", purchaseId: "purchase_1", status: "revoked", remainingCredits: 1 }
    mockPrisma.packagePurchase.findUnique.mockResolvedValueOnce(revoked)

    await expect(syncPackagePurchaseFromPaidPurchase({
      userId: "user_1", purchaseId: "purchase_1", metadata: { packageId: "pli-internal-general-class-credit-v1" },
    })).resolves.toBe(revoked)
    expect(mockPrisma.packagePurchase.create).not.toHaveBeenCalled()
    expect(mockPrisma.packagePlan.upsert).not.toHaveBeenCalled()
  })

  it.each(["reversed", "manual_resolution"])('fails closed when package consumption races a %s linked Purchase', async (status) => {
    const tx = {
      packageUsageLedger: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      packagePurchase: {
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: "package_purchase_1", purchaseId: "purchase_1", userId: "user_1", status: "active",
          isUnlimited: false, remainingCredits: 1, purchasedAt: new Date("2026-06-01T00:00:00.000Z"), expiresAt: null,
        }),
        update: vi.fn(), updateMany: vi.fn(),
      },
      purchase: { updateMany: vi.fn().mockResolvedValue({ count: 0, status }) },
    }

    await expect(reservePackageCreditForAttendanceTx(tx as never, {
      packagePurchaseId: "package_purchase_1", userId: "user_1", attendanceId: "attendance_1",
    })).rejects.toThrow("PACKAGE_PURCHASE_INELIGIBLE")

    expect(tx.purchase.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "purchase_1", status: "paid" },
    }))
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.create).not.toHaveBeenCalled()
  })

  it("does not reserve a package purchased after the attendance timestamp", async () => {
    const timestamp = new Date("2026-06-19T23:30:00.000Z")
    const tx = {
      packageUsageLedger: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      packagePurchase: { findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), updateMany: vi.fn() },
    }

    await expect(reservePackageCreditForAttendanceTx(tx as never, {
      packagePurchaseId: "package_purchase_1",
      userId: "user_1",
      attendanceId: "attendance_1",
      at: timestamp,
    })).rejects.toThrow("PACKAGE_NOT_AVAILABLE")

    expect(tx.packagePurchase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ purchasedAt: { lte: timestamp } }),
    }))
  })

  it("revokes only an unused internal one-credit package with a guarded update", async () => {
    const tx = {
      packageUsageLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      packagePurchase: {
        findUnique: vi.fn().mockResolvedValue({
          id: "package_purchase_1", purchaseId: "purchase_1", userId: "user_1",
          packageId: "pli-internal-general-class-credit-v1", status: "active",
          isUnlimited: false, totalCredits: 1, remainingCredits: 1,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }

    await expect(revokeUnusedInternalPackagePurchaseTx(tx as never, {
      purchaseId: "purchase_1", userId: "user_1",
    })).resolves.toBe("revoked")
    expect(tx.packageUsageLedger.findFirst).toHaveBeenCalledWith({ where: { packagePurchaseId: "package_purchase_1" } })
    expect(tx.packagePurchase.updateMany).toHaveBeenCalledWith({
      where: {
        id: "package_purchase_1", purchaseId: "purchase_1", userId: "user_1",
        packageId: "pli-internal-general-class-credit-v1", status: "active",
        isUnlimited: false, totalCredits: 1, remainingCredits: 1,
      },
      data: { status: "revoked" },
    })
  })

  it.each([
    ["consumed", { status: "exhausted", remainingCredits: 0, totalCredits: 1, isUnlimited: false }],
    ["ambiguous", { status: "active", remainingCredits: null, totalCredits: 1, isUnlimited: false }],
    ["usage history", { status: "active", remainingCredits: 1, totalCredits: 1, isUnlimited: false }],
  ])("requires manual resolution for a %s internal package state", async (_caseName, state) => {
    const tx = {
      packageUsageLedger: { findFirst: vi.fn().mockResolvedValue(_caseName === "usage history" ? { id: "usage_1" } : null) },
      packagePurchase: {
        findUnique: vi.fn().mockResolvedValue({
          id: "package_purchase_1", purchaseId: "purchase_1", userId: "user_1",
          packageId: "pli-internal-general-class-credit-v1", ...state,
        }),
        updateMany: vi.fn(),
      },
    }

    await expect(revokeUnusedInternalPackagePurchaseTx(tx as never, {
      purchaseId: "purchase_1", userId: "user_1",
    })).resolves.toBe("manual-resolution")
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled()
  })

  it("treats a concurrent refund or dispute revocation as an idempotent no-op", async () => {
    const revoked = {
      id: "package_purchase_1", purchaseId: "purchase_1", userId: "user_1",
      packageId: "pli-internal-general-class-credit-v1", status: "revoked",
      isUnlimited: false, totalCredits: 1, remainingCredits: 1,
    }
    const tx = {
      packageUsageLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      packagePurchase: {
        findUnique: vi.fn().mockResolvedValueOnce({ ...revoked, status: "active" }).mockResolvedValueOnce(revoked),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    }

    await expect(revokeUnusedInternalPackagePurchaseTx(tx as never, {
      purchaseId: "purchase_1", userId: "user_1",
    })).resolves.toBe("already-revoked")
  })
})
