import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAttendanceFindFirst = vi.fn()
const mockPurchaseFindFirst = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendance: {
      findFirst: (...args: unknown[]) => mockAttendanceFindFirst(...args),
    },
    purchase: {
      findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
    },
  },
}))

import { hasAttendedCourseToday, hasPurchaseForCourseToday } from "@/lib/checkin/consecutive-class"

// ─── hasAttendedCourseToday ─────────────────────────────────────

describe("hasAttendedCourseToday", () => {
  beforeEach(() => {
    mockAttendanceFindFirst.mockReset()
  })

  it("returns true when attendance exists with checked_in status", async () => {
    mockAttendanceFindFirst.mockResolvedValue({
      id: "att_1",
      userId: "user_1",
      status: "checked_in",
    })

    const result = await hasAttendedCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(true)
  })

  it("returns true when attendance exists with checked_in_no_package status", async () => {
    mockAttendanceFindFirst.mockResolvedValue({
      id: "att_1",
      userId: "user_1",
      status: "checked_in_no_package",
    })

    const result = await hasAttendedCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(true)
  })

  it("returns false when no attendance exists", async () => {
    mockAttendanceFindFirst.mockResolvedValue(null)

    const result = await hasAttendedCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(false)
  })

  it("queries with correct userId, status, and session filter", async () => {
    mockAttendanceFindFirst.mockResolvedValue(null)

    const testDate = new Date("2026-03-24T16:00:00.000Z")
    await hasAttendedCourseToday("user_1", "salsa", testDate)

    const callArgs = mockAttendanceFindFirst.mock.calls[0][0]
    expect(callArgs.where.userId).toBe("user_1")
    expect(callArgs.where.status.in).toContain("checked_in")
    expect(callArgs.where.status.in).toContain("checked_in_no_package")
    expect(callArgs.where.session.courseSlug).toBe("salsa")
    expect(callArgs.where.session.startsAt.gte).toBeDefined()
    expect(callArgs.where.session.startsAt.lt).toBeDefined()
  })

  it("trims and lowercases the course slug", async () => {
    mockAttendanceFindFirst.mockResolvedValue(null)

    await hasAttendedCourseToday("user_1", "  SALSA  ", new Date("2026-03-24T16:00:00.000Z"))

    const callArgs = mockAttendanceFindFirst.mock.calls[0][0]
    expect(callArgs.where.session.courseSlug).toBe("salsa")
  })

  it("uses current time when no date is provided", async () => {
    mockAttendanceFindFirst.mockResolvedValue(null)

    await hasAttendedCourseToday("user_1", "salsa")

    expect(mockAttendanceFindFirst).toHaveBeenCalled()
  })
})

// ─── hasPurchaseForCourseToday ──────────────────────────────────

describe("hasPurchaseForCourseToday", () => {
  beforeEach(() => {
    mockPurchaseFindFirst.mockReset()
  })

  it("returns true when purchase exists with paid status", async () => {
    mockPurchaseFindFirst.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      status: "paid",
    })

    const result = await hasPurchaseForCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(true)
  })

  it("returns true when purchase exists with succeeded status", async () => {
    mockPurchaseFindFirst.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      status: "succeeded",
    })

    const result = await hasPurchaseForCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(true)
  })

  it("returns true when purchase exists with completed status", async () => {
    mockPurchaseFindFirst.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      status: "completed",
    })

    const result = await hasPurchaseForCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(true)
  })

  it("returns false when no purchase exists", async () => {
    mockPurchaseFindFirst.mockResolvedValue(null)

    const result = await hasPurchaseForCourseToday("user_1", "salsa", new Date("2026-03-24T16:00:00.000Z"))

    expect(result).toBe(false)
  })

  it("queries with correct userId, courseSlug, status, and date range", async () => {
    mockPurchaseFindFirst.mockResolvedValue(null)

    const testDate = new Date("2026-03-24T16:00:00.000Z")
    await hasPurchaseForCourseToday("user_1", "salsa", testDate)

    const callArgs = mockPurchaseFindFirst.mock.calls[0][0]
    expect(callArgs.where.userId).toBe("user_1")
    expect(callArgs.where.courseSlug).toBe("salsa")
    expect(callArgs.where.status.in).toContain("paid")
    expect(callArgs.where.status.in).toContain("succeeded")
    expect(callArgs.where.status.in).toContain("completed")
    expect(callArgs.where.createdAt.gte).toBeDefined()
    expect(callArgs.where.createdAt.lt).toBeDefined()
  })

  it("trims and lowercases the course slug", async () => {
    mockPurchaseFindFirst.mockResolvedValue(null)

    await hasPurchaseForCourseToday("user_1", "  SALSA  ", new Date("2026-03-24T16:00:00.000Z"))

    const callArgs = mockPurchaseFindFirst.mock.calls[0][0]
    expect(callArgs.where.courseSlug).toBe("salsa")
  })
})
