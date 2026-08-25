import { beforeEach, describe, expect, it, vi } from "vitest"

const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockAttendanceFindFirst = vi.fn()
const mockClassSessionUpsert = vi.fn()
const mockAttendanceFindUnique = vi.fn()
const mockAttendanceCreate = vi.fn()
const mockAttendanceUpdate = vi.fn()

const mockTx = {
  attendance: {
    findFirst: (...args: unknown[]) => mockAttendanceFindFirst(...args),
    findUnique: (...args: unknown[]) => mockAttendanceFindUnique(...args),
    create: (...args: unknown[]) => mockAttendanceCreate(...args),
    update: (...args: unknown[]) => mockAttendanceUpdate(...args),
  },
  classSession: {
    upsert: (...args: unknown[]) => mockClassSessionUpsert(...args),
  },
  packageUsageLedger: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  packagePurchase: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}

const mockPrisma = {
  $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/class-schedule", () => ({
  buildSessionStartsAt: vi.fn(() => new Date("2026-05-08T20:10:00.000Z")),
  getCourseBySlug: vi.fn(() => ({ title: "Salsa Beginner / Open Level" })),
}))

vi.mock("@/lib/packages", () => ({
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => mockReservePackageCreditForAttendanceTx(...args),
}))

describe("syncScheduledAttendanceFromPurchase", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAttendanceFindFirst.mockReset()
    mockClassSessionUpsert.mockReset()
    mockAttendanceFindUnique.mockReset()
    mockAttendanceCreate.mockReset()
    mockAttendanceUpdate.mockReset()
    mockReservePackageCreditForAttendanceTx.mockReset()
  })

  it("upgrades existing purchase-linked scheduled attendance to checked_in", async () => {
    mockAttendanceFindFirst.mockResolvedValue({
      id: "att_1",
      status: "scheduled",
      metadata: { source: "purchase_booking", purchaseId: "purchase_1" },
    })

    const { syncScheduledAttendanceFromPurchase } = await import("@/lib/bookings")
    await syncScheduledAttendanceFromPurchase({
      userId: "user_1",
      purchaseId: "purchase_1",
      courseSlug: "salsa-night-beginner",
      date: "2026-05-08",
      time: "20:10",
      preferredStatus: "checked_in",
      source: "stripe_webhook_checkout",
    })

    expect(mockAttendanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att_1" },
        data: expect.objectContaining({ status: "checked_in" }),
      })
    )
    expect(mockAttendanceCreate).not.toHaveBeenCalled()
  })

  it("reuses existing session attendance and links purchase metadata instead of duplicating", async () => {
    mockAttendanceFindFirst.mockResolvedValue(null)
    mockClassSessionUpsert.mockResolvedValue({ id: "session_1" })
    mockAttendanceFindUnique.mockResolvedValue({
      id: "att_existing",
      status: "scheduled",
      metadata: { source: "manual" },
    })

    const { syncScheduledAttendanceFromPurchase } = await import("@/lib/bookings")
    await syncScheduledAttendanceFromPurchase({
      userId: "user_1",
      purchaseId: "purchase_1",
      courseSlug: "salsa-night-beginner",
      date: "2026-05-08",
      time: "20:10",
      preferredStatus: "checked_in",
      source: "stripe_webhook_checkout",
    })

    expect(mockAttendanceCreate).not.toHaveBeenCalled()
    expect(mockAttendanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att_existing" },
        data: expect.objectContaining({
          status: "checked_in",
          metadata: expect.objectContaining({
            purchaseId: "purchase_1",
            source: "stripe_webhook_checkout",
          }),
        }),
      })
    )
  })

  it("preserves the fixed special session capacity, time, duration, and location", async () => {
    mockAttendanceFindFirst.mockResolvedValue(null)
    mockClassSessionUpsert.mockResolvedValue({ id: "special_session_1" })
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockAttendanceCreate.mockResolvedValue({ id: "attendance_1", status: "scheduled" })

    const { syncScheduledAttendanceFromPurchase } = await import("@/lib/bookings")
    await syncScheduledAttendanceFromPurchase({
      userId: "user_1",
      purchaseId: "purchase_1",
      courseSlug: "special-salsa-calena-2026-08-30",
      courseTitle: "Browser-authored title",
      date: "2030-01-01",
      time: "01:00",
      preferredStatus: "scheduled",
    })

    expect(mockClassSessionUpsert).toHaveBeenCalledWith({
      where: {
        courseSlug_startsAt: {
          courseSlug: "special-salsa-calena-2026-08-30",
          startsAt: new Date("2026-08-30T20:00:00.000Z"),
        },
      },
      update: {
        title: "Special Salsa Caleña Class",
        durationMinutes: 60,
        capacity: 40,
        location: "54 Coles St, Jersey City",
      },
      create: {
        courseSlug: "special-salsa-calena-2026-08-30",
        title: "Special Salsa Caleña Class",
        startsAt: new Date("2026-08-30T20:00:00.000Z"),
        durationMinutes: 60,
        capacity: 40,
        location: "54 Coles St, Jersey City",
      },
    })
  })
})
