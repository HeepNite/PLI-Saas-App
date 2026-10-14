import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    packagePurchase: { findUnique: vi.fn(), create: vi.fn() },
    packagePlan: { findUniqueOrThrow: vi.fn(), upsert: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  buildPackagePurchasePayload,
  consumeHeldPackageCreditForAttendanceTx,
  holdPackageCreditForAttendanceTx,
  releasePackageCreditUsageTx,
  reservePackageCreditForAttendanceTx,
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

  it("holds finite package capacity without decrementing remaining credits", async () => {
    const pkg = { id: "package_1", userId: "user_1", isUnlimited: false, remainingCredits: 4, status: "active" }
    const hold = { id: "usage_1", packagePurchaseId: pkg.id, attendanceId: "attendance_1", delta: 0 }
    const tx = {
      packageUsageLedger: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue(hold),
      },
      packagePurchase: {
        findFirst: vi.fn().mockResolvedValue(pkg),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    }

    const result = await holdPackageCreditForAttendanceTx(tx as never, {
      packagePurchaseId: pkg.id,
      userId: "user_1",
      attendanceId: "attendance_1",
      courseSlug: "salsa-night-beginner",
      at: new Date("2026-10-05T01:10:00.000Z"),
    })

    expect(result).toMatchObject({ packagePurchase: pkg, usage: hold, held: true })
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: 0, reason: "PUBLIC_BOOKING_HOLD" }),
    })
  })

  it("rejects a hold when scheduled holds already exhaust finite package capacity", async () => {
    const tx = {
      packageUsageLedger: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn(),
      },
      packagePurchase: {
        findFirst: vi.fn().mockResolvedValue({ id: "package_1", userId: "user_1", isUnlimited: false, remainingCredits: 2 }),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    }

    await expect(holdPackageCreditForAttendanceTx(tx as never, {
      packagePurchaseId: "package_1",
      userId: "user_1",
      attendanceId: "attendance_1",
    })).rejects.toThrow("PACKAGE_NO_CREDITS")
    expect(tx.packageUsageLedger.create).not.toHaveBeenCalled()
  })

  it("converts a scheduled hold into one consumed credit when attendance becomes attended", async () => {
    const usage = { id: "usage_1", packagePurchaseId: "package_1", attendanceId: "attendance_1", userId: "user_1", delta: 0 }
    const tx = {
      packageUsageLedger: {
        findUnique: vi.fn().mockResolvedValue({ ...usage, packagePurchase: { id: "package_1", isUnlimited: false, remainingCredits: 4 } }),
        update: vi.fn().mockResolvedValue({ ...usage, delta: -1 }),
      },
      packagePurchase: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: "package_1", isUnlimited: false, remainingCredits: 3, status: "active" }),
        update: vi.fn(),
      },
    }

    const result = await consumeHeldPackageCreditForAttendanceTx(tx as never, {
      attendanceId: "attendance_1",
      userId: "user_1",
      reason: "ATTENDANCE_COMPLETED",
    })

    expect(result).toMatchObject({ consumed: true })
    expect(tx.packagePurchase.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ remainingCredits: { decrement: 1 } }),
    }))
    expect(tx.packageUsageLedger.update).toHaveBeenCalledWith({
      where: { id: "usage_1" },
      data: expect.objectContaining({ delta: -1, reason: "ATTENDANCE_COMPLETED" }),
    })
  })

  it("releases an unconsumed hold without incrementing package credits", async () => {
    const tx = {
      packageUsageLedger: {
        findUnique: vi.fn().mockResolvedValue({
          id: "usage_1",
          packagePurchaseId: "package_1",
          attendanceId: "attendance_1",
          delta: 0,
          packagePurchase: { id: "package_1", status: "active" },
        }),
        delete: vi.fn().mockResolvedValue({ id: "usage_1" }),
      },
      packagePurchase: { update: vi.fn() },
    }

    const result = await releasePackageCreditUsageTx(tx as never, { attendanceId: "attendance_1" })

    expect(result).toEqual({ released: true, restored: false })
    expect(tx.packagePurchase.update).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.delete).toHaveBeenCalledWith({ where: { id: "usage_1" } })
  })
})
