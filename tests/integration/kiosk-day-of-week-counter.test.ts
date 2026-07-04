/**
 * Integration tests for kiosk fast-checkout day-of-week counter.
 *
 * These tests cover:
 *   - Task 5.5: bootstrap API includes quickRepeatEligible + dayOfWeekPurchaseCount
 *   - Task 5.6: cash checkout API creates/updates DayOfWeekPurchaseCount row
 *
 * NOTE: This project does not have a live test database harness for API routes.
 *   All integration assertions are written against mocked Prisma clients that
 *   simulate the real DB contract. Once a test-DB harness is available (e.g.
 *   Prisma test environment with migrations applied), replace the mocks below
 *   with real DB queries.
 *
 * TODO(test-harness): When a test DB is available:
 *   1. Remove all vi.mock("@/lib/prisma") calls in this file.
 *   2. Replace mockFindUnique / mockTransaction helpers with real prisma client.
 *   3. Seed `DayOfWeekPurchaseCount` rows in beforeEach using prisma.dayOfWeekPurchaseCount.upsert().
 *   4. Tear down seeded rows in afterEach.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Shared Prisma mock ───────────────────────────────────────────────────────

const mockDowFindUnique = vi.fn()
const mockDowUpsert = vi.fn()
const mockDowCreate = vi.fn()
const mockDowUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dayOfWeekPurchaseCount: {
      findUnique: (...args: unknown[]) => mockDowFindUnique(...args),
      upsert: (...args: unknown[]) => mockDowUpsert(...args),
      create: (...args: unknown[]) => mockDowCreate(...args),
      update: (...args: unknown[]) => mockDowUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

import { getDayOfWeekCount, isQuickRepeatEligible } from "@/lib/checkin/day-of-week-counter"

// ─── Task 5.5: bootstrap API — quickRepeatEligible field ─────────────────────

describe("bootstrap API — quick repeat eligibility (Task 5.5)", () => {
  beforeEach(() => {
    mockDowFindUnique.mockReset()
    mockDowUpsert.mockReset()
    mockTransaction.mockReset()
  })

  /**
   * TODO(test-harness): Replace with a real HTTP call to /api/checkin/qr/bootstrap
   * once a test DB is available. The real route calls getDayOfWeekCount() and
   * sets quickRepeatEligible = count >= 3 in the terminal-only response branch.
   *
   * For now, this test directly exercises the utility functions that the route calls,
   * asserting the same logic the route would expose.
   */
  it("returns quickRepeatEligible: true when seeded count is 3", async () => {
    // Simulate: DayOfWeekPurchaseCount row with count=3 exists in DB
    mockDowFindUnique.mockResolvedValue({ count: 3 })

    const count = await getDayOfWeekCount("user_stub", 3)
    const eligible = await isQuickRepeatEligible("user_stub", 3)

    expect(count).toBe(3)
    // The bootstrap route sets quickRepeatEligible = count >= 3
    expect(eligible).toBe(true)
  })

  it("includes dayOfWeekPurchaseCount value equal to the seeded count", async () => {
    mockDowFindUnique.mockResolvedValue({ count: 5 })

    const count = await getDayOfWeekCount("user_stub", 3)

    // The bootstrap route maps this value directly to dayOfWeekPurchaseCount
    expect(count).toBe(5)
  })

  it("returns quickRepeatEligible: false when count is below 3", async () => {
    mockDowFindUnique.mockResolvedValue({ count: 2 })

    const eligible = await isQuickRepeatEligible("user_stub", 3)

    expect(eligible).toBe(false)
  })

  it("returns quickRepeatEligible: false when no record exists", async () => {
    mockDowFindUnique.mockResolvedValue(null)

    const eligible = await isQuickRepeatEligible("user_stub", 3)

    expect(eligible).toBe(false)
  })
})

// ─── Task 5.6: cash checkout API — counter update after purchase ──────────────

describe("cash checkout API — DayOfWeekPurchaseCount created/updated (Task 5.6)", () => {
  beforeEach(() => {
    mockDowFindUnique.mockReset()
    mockDowUpsert.mockReset()
    mockDowCreate.mockReset()
    mockDowUpdate.mockReset()
    mockTransaction.mockReset()
  })

  /**
   * TODO(test-harness): Replace with a real HTTP call to /api/checkout/cash
   * once a test DB is available. The real route calls incrementDayOfWeekCounter()
   * after a successful purchase, which either creates or updates the
   * DayOfWeekPurchaseCount row inside a $transaction.
   *
   * For now, this test asserts the $transaction callback behavior directly by
   * simulating the incrementDayOfWeekCounter call.
   */
  it("creates a new DayOfWeekPurchaseCount row after first successful purchase", async () => {
    // No existing row → $transaction should call tx.dayOfWeekPurchaseCount.create
    const txCreate = vi.fn().mockResolvedValue({})
    const txFindUnique = vi.fn().mockResolvedValue(null)

    const tx = {
      dayOfWeekPurchaseCount: {
        findUnique: txFindUnique,
        create: txCreate,
        update: vi.fn(),
      },
    }

    mockTransaction.mockImplementation((cb: (arg: typeof tx) => Promise<unknown>) => cb(tx))

    const { incrementDayOfWeekCounter } = await import("@/lib/checkin/day-of-week-counter")
    await incrementDayOfWeekCounter("user_new", new Date("2026-06-25T20:00:00.000Z"))

    expect(txCreate).toHaveBeenCalledOnce()
    const args = txCreate.mock.calls[0][0]
    expect(args.data.userId).toBe("user_new")
    expect(args.data.count).toBe(1)
  })

  it("increments existing DayOfWeekPurchaseCount row after subsequent purchase on new day", async () => {
    // Existing row from a previous week → $transaction should call tx.dayOfWeekPurchaseCount.update
    const previousDate = new Date("2026-06-18T00:00:00.000Z")
    const txUpdate = vi.fn().mockResolvedValue({})
    const txFindUnique = vi.fn().mockResolvedValue({
      id: "dow_1",
      lastCountedDate: previousDate,
    })

    const tx = {
      dayOfWeekPurchaseCount: {
        findUnique: txFindUnique,
        create: vi.fn(),
        update: txUpdate,
      },
    }

    mockTransaction.mockImplementation((cb: (arg: typeof tx) => Promise<unknown>) => cb(tx))

    const { incrementDayOfWeekCounter } = await import("@/lib/checkin/day-of-week-counter")
    await incrementDayOfWeekCounter("user_existing", new Date("2026-06-25T20:00:00.000Z"))

    expect(txUpdate).toHaveBeenCalledOnce()
    const args = txUpdate.mock.calls[0][0]
    expect(args.data.count).toEqual({ increment: 1 })
  })

  it("does NOT update the row when called again on the same ET calendar date (idempotent)", async () => {
    // Existing row with lastCountedDate matching today → same-day guard must fire.
    // 2026-06-25T04:00:00Z = midnight ET (EDT = UTC-4), so getEtDateIso returns "2026-06-25".
    const todayEtDate = new Date("2026-06-25T04:00:00.000Z")
    const txUpdate = vi.fn().mockResolvedValue({})
    const txCreate = vi.fn().mockResolvedValue({})
    const txFindUnique = vi.fn().mockResolvedValue({
      id: "dow_1",
      lastCountedDate: todayEtDate,
    })

    const tx = {
      dayOfWeekPurchaseCount: {
        findUnique: txFindUnique,
        create: txCreate,
        update: txUpdate,
      },
    }

    mockTransaction.mockImplementation((cb: (arg: typeof tx) => Promise<unknown>) => cb(tx))

    const { incrementDayOfWeekCounter } = await import("@/lib/checkin/day-of-week-counter")
    // Purchase date is later on the same ET day
    await incrementDayOfWeekCounter("user_existing", new Date("2026-06-25T22:00:00.000Z"))

    expect(txUpdate).not.toHaveBeenCalled()
    expect(txCreate).not.toHaveBeenCalled()
  })
})
