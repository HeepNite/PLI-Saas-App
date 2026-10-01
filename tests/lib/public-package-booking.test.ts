import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/class-schedule", () => ({
  buildSessionStartsAt: vi.fn(() => new Date("2026-10-06T01:10:00.000Z")),
  getCourseBySlug: vi.fn(() => ({ slug: "salsa-night-beginner", title: "Salsa Beginner" })),
  isTimeAllowedForCourseDate: vi.fn(() => true),
}))

import { reservePublicPackageBooking } from "@/lib/bookings/public-package-booking"

const input = {
  userId: "user_1",
  courseSlug: "salsa-night-beginner",
  date: "2026-10-05",
  time: "21:10",
  now: new Date("2026-10-01T12:00:00.000Z"),
}

const createDb = () => {
  const tx = {
    packagePurchase: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    classSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "session_1", capacity: 12 }),
    },
    attendance: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "attendance_1", status: "scheduled" }),
    },
    packageUsageLedger: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "usage_1", delta: 0 }),
    },
  }
  const db = {
    $transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
  }
  return { db, tx }
}

describe("public package booking", () => {
  beforeEach(() => vi.clearAllMocks())

  it("falls back to regular checkout when no applicable owned package exists", async () => {
    const { db, tx } = createDb()
    tx.packagePurchase.findMany.mockResolvedValue([])

    const result = await reservePublicPackageBooking(db as never, input)

    expect(result).toEqual({ kind: "no_package" })
    expect(tx.attendance.create).not.toHaveBeenCalled()
  })

  it("creates one scheduled attendance and a zero-delta package hold", async () => {
    const { db, tx } = createDb()
    const ownedPackage = {
      id: "package_1",
      packageId: "first-groove",
      packageLabel: "First Groove",
      courseSlug: "salsa-night-beginner",
      packagePlanId: null,
      packagePlan: null,
      status: "active",
      isUnlimited: false,
      remainingCredits: 4,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    }
    tx.packagePurchase.findMany.mockResolvedValue([ownedPackage])
    tx.packagePurchase.findFirst.mockResolvedValue(ownedPackage)

    const result = await reservePublicPackageBooking(db as never, input)

    expect(result).toMatchObject({
      kind: "reserved",
      attendanceId: "attendance_1",
      packagePurchaseId: "package_1",
      remainingCredits: 4,
    })
    expect(tx.classSession.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { title: "Salsa Beginner" },
    }))
    expect(tx.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "scheduled", userId: "user_1" }),
    })
    expect(tx.packageUsageLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        packagePurchaseId: "package_1",
        attendanceId: "attendance_1",
        delta: 0,
        reason: "PUBLIC_BOOKING_HOLD",
      }),
    })
  })

  it("preserves an existing session capacity when checking whether the class is full", async () => {
    const { db, tx } = createDb()
    tx.classSession.findUnique.mockResolvedValue({ id: "session_1", capacity: 4 })
    tx.packagePurchase.findMany.mockResolvedValue([{
      id: "package_1",
      packageId: "first-groove",
      packageLabel: "First Groove",
      courseSlug: "salsa-night-beginner",
      packagePlanId: null,
      packagePlan: null,
      status: "active",
      isUnlimited: false,
      remainingCredits: 4,
      expiresAt: null,
    }])
    tx.attendance.count.mockResolvedValue(4)

    const result = await reservePublicPackageBooking(db as never, input)

    expect(result).toEqual({ kind: "class_full" })
    expect(tx.classSession.upsert).not.toHaveBeenCalled()
    expect(tx.attendance.create).not.toHaveBeenCalled()
  })

  it("rejects finite package oversubscription before creating attendance", async () => {
    const { db, tx } = createDb()
    tx.packagePurchase.findMany.mockResolvedValue([
      {
        id: "package_1",
        packageId: "first-groove",
        packageLabel: "First Groove",
        courseSlug: "salsa-night-beginner",
        packagePlanId: null,
        packagePlan: null,
        status: "active",
        isUnlimited: false,
        remainingCredits: 1,
        expiresAt: null,
      },
    ])
    tx.packageUsageLedger.count.mockResolvedValue(1)

    const result = await reservePublicPackageBooking(db as never, input)

    expect(result).toEqual({ kind: "no_credits" })
    expect(tx.attendance.create).not.toHaveBeenCalled()
  })

  it("replays a final-credit reservation before reevaluating package availability", async () => {
    const { db, tx } = createDb()
    tx.classSession.findUnique.mockResolvedValue({ id: "session_1", capacity: 12 })
    tx.attendance.findUnique.mockResolvedValue({
      id: "attendance_existing",
      status: "scheduled",
      packageUsage: { packagePurchaseId: "package_1", delta: 0 },
    })

    const result = await reservePublicPackageBooking(db as never, input)

    expect(result).toMatchObject({ kind: "reserved", attendanceId: "attendance_existing", replayed: true })
    expect(tx.packagePurchase.findMany).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.count).not.toHaveBeenCalled()
    expect(tx.attendance.create).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.create).not.toHaveBeenCalled()
  })
})
