import type { PrismaClient, StaffClockEntry } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  closeOpenClockEntriesForPayroll,
  computeClosureTimestamp,
  GRACE_MINUTES,
  MAX_DAILY_PAYABLE_MINUTES,
} from "@/lib/payroll/auto-closure"
import { deriveHoursWorked } from "@/lib/payroll/hours"

// ── computeClosureTimestamp (pure function) ──────────────────────────

describe("computeClosureTimestamp", () => {
  const clockInAt = new Date("2026-04-01T09:00:00.000Z")

  it("applies 15m grace when expected+grace < now and < daily cap", () => {
    const expectedClockOutAt = new Date("2026-04-01T17:00:00.000Z")
    // graceAt = 17:15, dailyCapAt = 19:00, now is later than both
    const now = new Date("2026-04-01T20:00:00.000Z")

    const result = computeClosureTimestamp(clockInAt, expectedClockOutAt, now)

    expect(result.closureAt.toISOString()).toBe("2026-04-01T17:15:00.000Z")
    expect(result.reason).toBe("on_demand_expected_grace")
  })

  it("caps at 10h (600m) when daily cap is the minimum", () => {
    // expectedClockOutAt far in the future, so cap wins
    const expectedClockOutAt = new Date("2026-04-02T09:00:00.000Z")
    const now = new Date("2026-04-02T10:00:00.000Z")

    const result = computeClosureTimestamp(clockInAt, expectedClockOutAt, now)

    // dailyCapAt = 09:00 + 10h = 19:00 same day
    expect(result.closureAt.toISOString()).toBe("2026-04-01T19:00:00.000Z")
    expect(result.reason).toBe("on_demand_daily_cap")
  })

  it("uses now when now < expected+grace and now < daily cap", () => {
    const expectedClockOutAt = new Date("2026-04-01T17:00:00.000Z")
    // now at 10:00, graceAt = 17:15, dailyCapAt = 19:00
    const now = new Date("2026-04-01T10:00:00.000Z")

    const result = computeClosureTimestamp(clockInAt, expectedClockOutAt, now)

    expect(result.closureAt.toISOString()).toBe("2026-04-01T10:00:00.000Z")
    expect(result.reason).toBe("on_demand_now_guardrail")
  })

  it("falls back to now/cap when expectedClockOutAt is null", () => {
    const now = new Date("2026-04-01T14:00:00.000Z")

    const result = computeClosureTimestamp(clockInAt, null, now)

    // now < dailyCapAt (19:00), so now wins
    expect(result.closureAt.toISOString()).toBe("2026-04-01T14:00:00.000Z")
    expect(result.reason).toBe("on_demand_now_guardrail")
  })

  it("falls back to cap when expectedClockOutAt is null and now > cap", () => {
    const now = new Date("2026-04-02T01:00:00.000Z")

    const result = computeClosureTimestamp(clockInAt, null, now)

    // dailyCapAt = 19:00 on Apr 1
    expect(result.closureAt.toISOString()).toBe("2026-04-01T19:00:00.000Z")
    expect(result.reason).toBe("on_demand_daily_cap")
  })

  it("falls back to guardrail when expectedClockOutAt <= clockInAt (zero-duration)", () => {
    const expectedClockOutAt = new Date("2026-04-01T08:00:00.000Z") // before clockInAt!
    const now = new Date("2026-04-01T14:00:00.000Z")

    const result = computeClosureTimestamp(clockInAt, expectedClockOutAt, now)

    expect(result.closureAt.toISOString()).toBe("2026-04-01T14:00:00.000Z")
    expect(result.reason).toBe("on_demand_now_guardrail")
  })
})

// ── closeOpenClockEntriesForPayroll (integration with mocked prisma) ─

describe("closeOpenClockEntriesForPayroll", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let findManyMock: ReturnType<typeof vi.fn>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let findUniqueMock: ReturnType<typeof vi.fn>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateMock: ReturnType<typeof vi.fn>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any

  beforeEach(() => {
    findManyMock = vi.fn()
    findUniqueMock = vi.fn()
    updateMock = vi.fn()

    prisma = {
      staffClockEntry: {
        findMany: findManyMock,
        findUnique: findUniqueMock,
        update: updateMock,
      },
    } as unknown as PrismaClient
  })

  it("closes open entries and sets status + metadata", async () => {
    const clockInAt = new Date("2026-04-01T09:00:00.000Z")
    const expectedClockOutAt = new Date("2026-04-01T17:00:00.000Z")
    const now = new Date("2026-04-01T18:00:00.000Z")

    findManyMock.mockResolvedValue([
      {
        id: "entry_1",
        staffAccountId: "staff_1",
        clockInAt,
        expectedClockOutAt,
      },
    ])
    findUniqueMock.mockResolvedValue({ metadata: null })
    updateMock.mockResolvedValue({})

    const result = await closeOpenClockEntriesForPayroll(prisma, {
      source: "payroll-read-entries",
      now,
    })

    expect(result.closedCount).toBe(1)
    expect(result.entryIds).toEqual(["entry_1"])

    // Verify update was called with correct closure timestamp
    expect(updateMock).toHaveBeenCalledTimes(1)
    const updateArgs = updateMock.mock.calls[0][0]
    // graceAt = 17:15, now = 18:00, cap = 19:00 → closureAt = 17:15
    expect(updateArgs.data.actualClockOutAt.toISOString()).toBe("2026-04-01T17:15:00.000Z")
    expect(updateArgs.data.status).toBe("clocked_out")
    expect(updateArgs.data.metadata.closureReason).toBe("on_demand_expected_grace")
    expect(updateArgs.data.metadata.closureSource).toBe("payroll-read-entries")
    expect(updateArgs.data.metadata.policySnapshot.graceMinutes).toBe(GRACE_MINUTES)
    expect(updateArgs.data.metadata.policySnapshot.maxDailyPayableMinutes).toBe(MAX_DAILY_PAYABLE_MINUTES)
  })

  it("is idempotent: does not touch already-closed entries", async () => {
    // findMany returns nothing because actualClockOutAt is not null
    findManyMock.mockResolvedValue([])

    const result = await closeOpenClockEntriesForPayroll(prisma, {
      source: "payroll-read-entries",
    })

    expect(result.closedCount).toBe(0)
    expect(result.entryIds).toEqual([])
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("caps closure at 10h daily limit", async () => {
    const clockInAt = new Date("2026-04-01T09:00:00.000Z")
    // expectedClockOutAt far in the future
    const expectedClockOutAt = new Date("2026-04-02T09:00:00.000Z")
    const now = new Date("2026-04-02T10:00:00.000Z")

    findManyMock.mockResolvedValue([
      {
        id: "entry_2",
        staffAccountId: "staff_1",
        clockInAt,
        expectedClockOutAt,
      },
    ])
    findUniqueMock.mockResolvedValue({ metadata: null })
    updateMock.mockResolvedValue({})

    const result = await closeOpenClockEntriesForPayroll(prisma, {
      source: "payroll-run-payday",
      now,
    })

    expect(result.closedCount).toBe(1)
    const updateArgs = updateMock.mock.calls[0][0]
    // dailyCapAt = 09:00 + 10h = 19:00 on Apr 1
    expect(updateArgs.data.actualClockOutAt.toISOString()).toBe("2026-04-01T19:00:00.000Z")
    expect(updateArgs.data.status).toBe("clocked_out")
    expect(updateArgs.data.metadata.closureReason).toBe("on_demand_daily_cap")
  })

  it("handles null expectedClockOutAt with guardrail fallback", async () => {
    const clockInAt = new Date("2026-04-01T09:00:00.000Z")
    const now = new Date("2026-04-01T14:00:00.000Z")

    findManyMock.mockResolvedValue([
      {
        id: "entry_3",
        staffAccountId: "staff_1",
        clockInAt,
        expectedClockOutAt: null,
      },
    ])
    findUniqueMock.mockResolvedValue({ metadata: null })
    updateMock.mockResolvedValue({})

    const result = await closeOpenClockEntriesForPayroll(prisma, {
      source: "payroll-me",
      now,
    })

    expect(result.closedCount).toBe(1)
    const updateArgs = updateMock.mock.calls[0][0]
    // now < dailyCap, so closureAt = now
    expect(updateArgs.data.actualClockOutAt.toISOString()).toBe("2026-04-01T14:00:00.000Z")
    expect(updateArgs.data.metadata.closureReason).toBe("on_demand_now_guardrail")
  })

  it("scopes by staffAccountId and period when provided", async () => {
    findManyMock.mockResolvedValue([])

    await closeOpenClockEntriesForPayroll(prisma, {
      staffAccountId: "staff_1",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-01T00:00:00.000Z"),
      source: "payroll-read-entries",
    })

    expect(findManyMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        staffAccountId: "staff_1",
        actualClockOutAt: null,
      }),
      select: expect.any(Object),
    })
  })
})

// ── deriveHoursWorked integration: auto-closed entry counted ─────────

describe("deriveHoursWorked after auto-closure", () => {
  it("counts an auto-closed entry in the same calculation", async () => {
    const mockFindMany = vi.fn()
    const prisma = {
      staffClockEntry: {
        findMany: mockFindMany,
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient

    const clockInAt = new Date("2026-04-01T09:00:00.000Z")
    const expectedClockOutAt = new Date("2026-04-01T17:00:00.000Z")
    const now = new Date("2026-04-01T18:00:00.000Z")

    // Step 1: findMany returns the open entry for closure
    mockFindMany.mockResolvedValueOnce([
      {
        id: "entry_1",
        staffAccountId: "staff_1",
        clockInAt,
        expectedClockOutAt,
      },
    ])
    prisma.staffClockEntry.findUnique = vi.fn().mockResolvedValue({ metadata: null })
    prisma.staffClockEntry.update = vi.fn().mockResolvedValue({})

    // Run closure
    const closureResult = await closeOpenClockEntriesForPayroll(prisma, {
      staffAccountId: "staff_1",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-01T00:00:00.000Z"),
      source: "payroll-read-entries",
      now,
    })

    expect(closureResult.closedCount).toBe(1)

    // Step 2: deriveHoursWorked queries with actualClockOutAt not null
    // Simulate that the entry is now closed with closureAt = 17:15 (grace)
    mockFindMany.mockResolvedValueOnce([
      {
        clockInAt,
        actualClockOutAt: new Date("2026-04-01T17:15:00.000Z"),
      },
    ])

    const { hoursWorked, entryCount } = await deriveHoursWorked(
      prisma,
      "staff_1",
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z"),
    )

    // 09:00 → 17:15 = 8.25 hours
    expect(entryCount).toBe(1)
    expect(hoursWorked).toBe(8.25)
  })
})
