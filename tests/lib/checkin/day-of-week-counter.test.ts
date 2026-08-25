import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Prisma mock (hoisted above the module import) ──────────────────────────

const mockTransaction = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockCreate = vi.fn()
const mockFindUniqueCount = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dayOfWeekPurchaseCount: {
      findUnique: (...args: unknown[]) => mockFindUniqueCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

import {
  getDayOfWeekCount,
  incrementDayOfWeekCounter,
  isQuickRepeatEligible,
} from "@/lib/checkin/day-of-week-counter"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a mock prisma transaction context that captures findUnique / update / create calls.
 * The callback passed to $transaction receives this mock tx object.
 */
function makeTxContext(existingRecord: { id: string; lastCountedDate: Date | null } | null) {
  const txFindUnique = vi.fn().mockResolvedValue(existingRecord)
  const txUpdate = vi.fn().mockResolvedValue({})
  const txCreate = vi.fn().mockResolvedValue({})

  const tx = {
    dayOfWeekPurchaseCount: {
      findUnique: txFindUnique,
      update: txUpdate,
      create: txCreate,
    },
  }

  // $transaction executes the callback immediately with the mock tx
  mockTransaction.mockImplementation((cb: (arg: typeof tx) => Promise<unknown>) => cb(tx))

  return { txFindUnique, txUpdate, txCreate }
}

// ─── incrementDayOfWeekCounter ───────────────────────────────────────────────

describe("incrementDayOfWeekCounter", () => {
  beforeEach(() => {
    mockTransaction.mockReset()
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockCreate.mockReset()
    mockFindUniqueCount.mockReset()
  })

  it("does NOT double-count when called twice on the same ET calendar date", async () => {
    // Two calls with purchase dates that resolve to the same ET date (2026-06-25)
    const purchaseDate = new Date("2026-06-25T20:00:00.000Z") // Wednesday ET

    // First call: no existing record → creates one
    const { txCreate: txCreate1 } = makeTxContext(null)
    await incrementDayOfWeekCounter("user_a", purchaseDate)
    expect(txCreate1).toHaveBeenCalledOnce()

    // Second call: existing record with lastCountedDate matching the same ET date.
    // 2026-06-25T04:00:00Z = midnight ET (EDT = UTC-4), so getEtDateIso returns "2026-06-25".
    const lastCountedDate = new Date("2026-06-25T04:00:00.000Z")
    const { txUpdate: txUpdate2, txCreate: txCreate2 } = makeTxContext({
      id: "dow_1",
      lastCountedDate,
    })
    await incrementDayOfWeekCounter("user_a", purchaseDate)

    // Same-day guard: neither update nor create should fire
    expect(txUpdate2).not.toHaveBeenCalled()
    expect(txCreate2).not.toHaveBeenCalled()
  })

  it("increments the count when called on a new calendar date", async () => {
    const previousDate = new Date("2026-06-18T00:00:00.000Z") // prior Wednesday ET
    const newDate = new Date("2026-06-25T20:00:00.000Z")      // current Wednesday ET

    const { txUpdate } = makeTxContext({
      id: "dow_1",
      lastCountedDate: previousDate,
    })

    await incrementDayOfWeekCounter("user_a", newDate)

    expect(txUpdate).toHaveBeenCalledOnce()
    const updateArgs = txUpdate.mock.calls[0][0]
    expect(updateArgs.data.count).toEqual({ increment: 1 })
    expect(updateArgs.data.lastCountedDate).toBeInstanceOf(Date)
  })

  it("creates a new row with count=1 on first-ever insert for that user + day", async () => {
    const purchaseDate = new Date("2026-06-25T20:00:00.000Z")

    const { txCreate } = makeTxContext(null)

    await incrementDayOfWeekCounter("user_new", purchaseDate)

    expect(txCreate).toHaveBeenCalledOnce()
    const createArgs = txCreate.mock.calls[0][0]
    expect(createArgs.data.userId).toBe("user_new")
    expect(createArgs.data.count).toBe(1)
    expect(createArgs.data.lastCountedDate).toBeInstanceOf(Date)
  })
})

// ─── isQuickRepeatEligible (boundary tests — Tasks 5.1 + 5.4) ───────────────

describe("isQuickRepeatEligible", () => {
  beforeEach(() => {
    mockFindUniqueCount.mockReset()
  })

  it("returns false when count is 0 (no prior purchases)", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 0 })
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(false)
  })

  it("returns false when count is 1 (below threshold)", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 1 })
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(false)
  })

  it("returns false when count is 2 (still below threshold)", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 2 })
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(false)
  })

  it("returns true when count is exactly 3 (at threshold)", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 3 })
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(true)
  })

  it("returns true when count is 4 (above threshold)", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 4 })
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(true)
  })

  it("returns true when count is 5 (well above threshold)", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 5 })
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(true)
  })

  it("returns false when no record exists (null from DB)", async () => {
    mockFindUniqueCount.mockResolvedValue(null)
    await expect(isQuickRepeatEligible("user_a", 3)).resolves.toBe(false)
  })
})

// ─── getDayOfWeekCount ───────────────────────────────────────────────────────

describe("getDayOfWeekCount", () => {
  beforeEach(() => {
    mockFindUniqueCount.mockReset()
  })

  it("returns the count from the DB record", async () => {
    mockFindUniqueCount.mockResolvedValue({ count: 7 })
    await expect(getDayOfWeekCount("user_a", 3)).resolves.toBe(7)
  })

  it("returns 0 when no record exists", async () => {
    mockFindUniqueCount.mockResolvedValue(null)
    await expect(getDayOfWeekCount("user_a", 3)).resolves.toBe(0)
  })
})
