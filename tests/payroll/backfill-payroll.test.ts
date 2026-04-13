import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

describe("backfill payroll from Clerk", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("parses default and explicit CLI arguments", async () => {
    const { parseBackfillPayrollArgs } = await import("@/scripts/backfill-payroll-from-clerk")

    expect(parseBackfillPayrollArgs([])).toEqual({ mode: "dry-run", schoolId: null })
    expect(parseBackfillPayrollArgs(["--mode=write", "--school-id= school_1 "])).toEqual({
      mode: "write",
      schoolId: "school_1",
    })
    expect(() => parseBackfillPayrollArgs(["--mode=boom"]))
      .toThrow("Invalid --mode value: boom. Expected dry-run or write.")
  })

  it("supports dry-run summaries without writing changes", async () => {
    const { runBackfillPayrollFromClerk } = await import("@/scripts/backfill-payroll-from-clerk")

    const prismaClient = {
      staffAccount: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "staff_1",
            clerkUserId: "clerk_1",
            email: "ana@example.com",
            hourlyRate: 100,
            paydayWeekday: 1,
          },
          {
            id: "staff_2",
            clerkUserId: "clerk_2",
            email: "beto@example.com",
            hourlyRate: 120,
            paydayWeekday: 2,
          },
          {
            id: "staff_3",
            clerkUserId: "clerk_3",
            email: "cora@example.com",
            hourlyRate: 140,
            paydayWeekday: 3,
          },
        ]),
        update: vi.fn(),
      },
    }

    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      table: vi.fn(),
    }

    const clerk = {
      users: {
        getUser: vi.fn()
          .mockResolvedValueOnce({
            publicMetadata: {
              schoolId: "school_1",
              staffPayroll: {
                hourlyRate: 150,
                paydayWeekday: 5,
                paidEntries: [{ id: "sentinel_1" }],
              },
            },
          })
          .mockResolvedValueOnce({
            publicMetadata: {
              schoolId: "school_2",
              staffPayroll: {
                hourlyRate: 999,
                paydayWeekday: 4,
              },
            },
          })
          .mockResolvedValueOnce({
            publicMetadata: {
              schoolId: "school_1",
              staffPayroll: {},
            },
          }),
      },
    }

    const summary = await runBackfillPayrollFromClerk(
      { mode: "dry-run", schoolId: "school_1" },
      { prismaClient, clerk: clerk as never, logger }
    )

    expect(prismaClient.staffAccount.update).not.toHaveBeenCalled()
    expect(summary).toMatchObject({
      mode: "dry-run",
      schoolId: "school_1",
      processed: 3,
      succeeded: 1,
      failed: 0,
      skipped: 2,
    })
    expect(summary.results).toEqual([
      expect.objectContaining({
        clerkUserId: "clerk_1",
        status: "updated",
        currentHourlyRate: 100,
        nextHourlyRate: 150,
        currentPaydayWeekday: 1,
        nextPaydayWeekday: 5,
        sentinelEntryCount: 1,
      }),
      expect.objectContaining({
        clerkUserId: "clerk_2",
        status: "skipped",
        reason: "school mismatch (school_2)",
      }),
      expect.objectContaining({
        clerkUserId: "clerk_3",
        status: "skipped",
        reason: "missing Clerk payroll metadata",
      }),
    ])
    expect(logger.warn).toHaveBeenCalledWith("Skipping clerk_3: missing Clerk payroll metadata")
    expect(logger.table).toHaveBeenCalledTimes(1)
    expect(logger.log).toHaveBeenCalledWith(
      "[backfill-payroll-from-clerk] mode=dry-run schoolId=school_1 processed=3 succeeded=1 failed=0 skipped=2"
    )
  })
})
