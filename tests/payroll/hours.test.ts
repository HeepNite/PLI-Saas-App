import type { PrismaClient, StaffClockEntry } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { calculateHoursForPeriod, deriveHoursWorked } from "@/lib/payroll/hours"

const makeEntry = (clockInAt: string, actualClockOutAt: string | null): StaffClockEntry =>
  ({
    id: `${clockInAt}-${actualClockOutAt ?? "open"}`,
    clerkUserId: "staff_user_1",
    schoolId: "school_1",
    clockInAt: new Date(clockInAt),
    clockOutAt: actualClockOutAt ? new Date(actualClockOutAt) : null,
    actualClockOutAt: actualClockOutAt ? new Date(actualClockOutAt) : null,
    source: "manual",
    notes: null,
    createdAt: new Date(clockInAt),
    updatedAt: new Date(clockInAt),
  } as unknown as StaffClockEntry)

const makeDbRow = (clockInAt: string, actualClockOutAt: string | null) => ({
  clockInAt: new Date(clockInAt),
  actualClockOutAt: actualClockOutAt ? new Date(actualClockOutAt) : null,
})

describe("calculateHoursForPeriod", () => {
  it("sums completed entries that fall fully within the requested period", () => {
    const periodStart = new Date("2026-04-01T00:00:00.000Z")
    const periodEnd = new Date("2026-04-07T23:59:59.999Z")

    const hours = calculateHoursForPeriod(
      [
        makeEntry("2026-04-01T09:00:00.000Z", "2026-04-01T11:30:00.000Z"),
        makeEntry("2026-04-03T13:15:00.000Z", "2026-04-03T17:00:00.000Z"),
      ],
      periodStart,
      periodEnd
    )

    expect(hours).toBe(6.25)
  })

  it("ignores open entries and entries outside the requested period", () => {
    const periodStart = new Date("2026-04-01T00:00:00.000Z")
    const periodEnd = new Date("2026-04-07T23:59:59.999Z")

    const hours = calculateHoursForPeriod(
      [
        makeEntry("2026-04-02T09:00:00.000Z", null),
        makeEntry("2026-03-31T23:00:00.000Z", "2026-04-01T01:00:00.000Z"),
        makeEntry("2026-04-07T22:00:00.000Z", "2026-04-08T01:00:00.000Z"),
        makeEntry("2026-04-04T08:00:00.000Z", "2026-04-04T10:00:00.000Z"),
      ],
      periodStart,
      periodEnd
    )

    expect(hours).toBe(2)
  })

  it("rounds the final total to two decimal places", () => {
    const periodStart = new Date("2026-04-01T00:00:00.000Z")
    const periodEnd = new Date("2026-04-07T23:59:59.999Z")

    const hours = calculateHoursForPeriod(
      [makeEntry("2026-04-05T09:00:00.000Z", "2026-04-05T10:20:00.000Z")],
      periodStart,
      periodEnd
    )

    expect(hours).toBe(1.33)
  })
})

describe("deriveHoursWorked", () => {
  const mockFindMany = vi.fn()
  const prisma = {
    staffClockEntry: { findMany: mockFindMany },
  } as unknown as PrismaClient

  const staffAccountId = "staff_1"
  const periodStart = new Date("2026-04-01T00:00:00.000Z")
  const periodEnd = new Date("2026-04-30T23:59:59.999Z")

  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it("returns hoursWorked and entryCount for closed shifts within period", async () => {
    mockFindMany.mockResolvedValue([
      makeDbRow("2026-04-01T09:00:00.000Z", "2026-04-01T17:00:00.000Z"),
      makeDbRow("2026-04-02T09:00:00.000Z", "2026-04-02T17:00:00.000Z"),
    ])

    const result = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)

    expect(result).toEqual({ hoursWorked: 16, entryCount: 2 })
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        staffAccountId,
        clockInAt: { gte: periodStart },
        actualClockOutAt: { lte: periodEnd, not: null },
      },
      select: { clockInAt: true, actualClockOutAt: true },
    })
  })

  it("excludes open entries where actualClockOutAt is null", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)

    expect(result).toEqual({ hoursWorked: 0, entryCount: 0 })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actualClockOutAt: { lte: periodEnd, not: null },
        }),
      })
    )
  })

  it("excludes entries whose clockInAt is before periodStart even if actualClockOutAt is within period", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)

    expect(result).toEqual({ hoursWorked: 0, entryCount: 0 })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clockInAt: { gte: periodStart },
        }),
      })
    )
  })

  it("rounds fractional hours to two decimal places", async () => {
    mockFindMany.mockResolvedValue([
      makeDbRow("2026-04-01T09:00:00.000Z", "2026-04-01T17:20:00.000Z"),
    ])

    const result = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)

    expect(result.hoursWorked).toBe(8.33)
    expect(result.entryCount).toBe(1)
  })

  it("returns zero hoursWorked and entryCount when no entries qualify", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)

    expect(result).toEqual({ hoursWorked: 0, entryCount: 0 })
  })

  it("includes overlapping entries without deduplication", async () => {
    mockFindMany.mockResolvedValue([
      makeDbRow("2026-04-01T09:00:00.000Z", "2026-04-01T17:00:00.000Z"),
      makeDbRow("2026-04-01T10:00:00.000Z", "2026-04-01T15:00:00.000Z"),
    ])

    const result = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)

    expect(result).toEqual({ hoursWorked: 13, entryCount: 2 })
  })
})
