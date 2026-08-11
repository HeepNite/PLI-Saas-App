import { beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_PIN_WINDOW_MS } from "@/lib/security/staff-pin-throttle"

type FakeCounterRow = {
  targetKey: string
  missCount: number
  lifetimeMissCount: number
  windowStart: Date
  blockedUntil: Date | null
  cooldownLevel: number
  lockedPermanentlyAt: Date | null
}

// In-memory fake standing in for the `staffPinAttemptCounter` Postgres table.
// `upsert`/`updateMany` are plain async functions with NO internal `await`,
// so each call's map mutation runs to completion synchronously before the
// next queued microtask starts — this is what lets the CONCURRENT-BURST test
// below prove real atomicity (no lost updates) rather than merely asserting
// against a trivially-serial mock.
const store = new Map<string, FakeCounterRow>()

const mockUpsert = vi.fn(async ({ where, create, update }: { where: { targetKey: string }; create: Partial<FakeCounterRow>; update: Record<string, unknown> }) => {
  const key = where.targetKey
  let row = store.get(key)
  if (!row) {
    row = {
      targetKey: key,
      missCount: 0,
      lifetimeMissCount: 0,
      windowStart: new Date(),
      blockedUntil: null,
      cooldownLevel: 0,
      lockedPermanentlyAt: null,
      ...create,
    }
    store.set(key, row)
    return { ...row }
  }
  const missIncrement = (update.missCount as { increment?: number } | undefined)?.increment
  const lifetimeIncrement = (update.lifetimeMissCount as { increment?: number } | undefined)?.increment
  if (typeof missIncrement === "number") row.missCount += missIncrement
  if (typeof lifetimeIncrement === "number") row.lifetimeMissCount += lifetimeIncrement
  return { ...row }
})

const mockUpdate = vi.fn(async ({ where, data }: { where: { targetKey: string }; data: Partial<FakeCounterRow> }) => {
  const row = store.get(where.targetKey)
  if (!row) throw new Error("not found")
  Object.assign(row, data)
  return { ...row }
})

const mockUpdateMany = vi.fn(async ({ where, data }: { where: { targetKey: string; windowStart?: { lt: Date } }; data: Partial<FakeCounterRow> }) => {
  const row = store.get(where.targetKey)
  if (!row) return { count: 0 }
  if (where.windowStart && !(row.windowStart < where.windowStart.lt)) return { count: 0 }
  Object.assign(row, data)
  return { count: 1 }
})

const mockFindUnique = vi.fn(async ({ where }: { where: { targetKey: string } }) => {
  const row = store.get(where.targetKey)
  return row ? { ...row } : null
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffPinAttemptCounter: {
      upsert: (...args: unknown[]) => (mockUpsert as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
      updateMany: (...args: unknown[]) => (mockUpdateMany as (...a: unknown[]) => unknown)(...args),
      findUnique: (...args: unknown[]) => (mockFindUnique as (...a: unknown[]) => unknown)(...args),
    },
  },
}))

describe("staff-pin-throttle", () => {
  beforeEach(() => {
    store.clear()
    mockUpsert.mockClear()
    mockUpdate.mockClear()
    mockUpdateMany.mockClear()
    mockFindUnique.mockClear()
  })

  it("records a first miss with missCount 1, not blocked", async () => {
    const { recordPinAttemptMiss } = await import("@/lib/security/staff-pin-throttle")

    const result = await recordPinAttemptMiss({ targetKey: "user:staff_1", kind: "user" })

    expect(result.missCount).toBe(1)
    expect(result.blocked).toBe(false)
  })

  it("BRUTE-FORCE LOCKOUT: trips blocked once a victim-keyed target reaches the cooldown threshold (5 misses)", async () => {
    const { recordPinAttemptMiss } = await import("@/lib/security/staff-pin-throttle")

    let last
    for (let i = 0; i < 5; i += 1) {
      last = await recordPinAttemptMiss({ targetKey: "user:staff_2", kind: "user" })
    }

    expect(last!.missCount).toBe(5)
    expect(last!.blocked).toBe(true)
    expect(last!.retryAfterSec).toBeGreaterThan(0)
  })

  it("escalates to a longer hard-block once missCount reaches 10", async () => {
    const { recordPinAttemptMiss } = await import("@/lib/security/staff-pin-throttle")

    let cooldownResult
    let hardResult
    for (let i = 0; i < 10; i += 1) {
      const result = await recordPinAttemptMiss({ targetKey: "user:staff_3", kind: "user" })
      if (i === 4) cooldownResult = result
      if (i === 9) hardResult = result
    }

    expect(cooldownResult!.retryAfterSec).toBeLessThan(hardResult!.retryAfterSec!)
  })

  it("PERMANENT LOCK: locks a user target once lifetimeMissCount reaches the 50 cap", async () => {
    store.set("user:staff_lifetime", {
      targetKey: "user:staff_lifetime",
      missCount: 0,
      lifetimeMissCount: 49,
      windowStart: new Date(),
      blockedUntil: null,
      cooldownLevel: 0,
      lockedPermanentlyAt: null,
    })

    const { recordPinAttemptMiss, isPinTargetBlocked } = await import("@/lib/security/staff-pin-throttle")

    const result = await recordPinAttemptMiss({ targetKey: "user:staff_lifetime", kind: "user" })
    expect(result.blocked).toBe(true)
    expect(result.retryAfterSec).toBeNull() // permanent, not a retryable window

    const status = await isPinTargetBlocked("user:staff_lifetime")
    expect(status.blocked).toBe(true)
  })

  it("CONCURRENT-BURST: N parallel misses at one target produce a final missCount exactly equal to N (no lost updates)", async () => {
    const { recordPinAttemptMiss } = await import("@/lib/security/staff-pin-throttle")

    const N = 25
    await Promise.all(
      Array.from({ length: N }, () => recordPinAttemptMiss({ targetKey: "user:staff_burst", kind: "user" }))
    )

    const finalRow = store.get("user:staff_burst")
    expect(finalRow!.missCount).toBe(N)
    expect(finalRow!.lifetimeMissCount).toBe(N)
  })

  it("TERMINAL AGGREGATE CAP: trips at a caller-supplied effectiveCap, independent of the generic 5-miss threshold", async () => {
    const { recordPinAttemptMiss } = await import("@/lib/security/staff-pin-throttle")

    const first = await recordPinAttemptMiss({ targetKey: "terminal:front-desk:targeted", kind: "terminal", effectiveCap: 2 })
    expect(first.blocked).toBe(false)

    const second = await recordPinAttemptMiss({ targetKey: "terminal:front-desk:targeted", kind: "terminal", effectiveCap: 2 })
    expect(second.blocked).toBe(true)
    expect(second.missCount).toBe(2)
  })

  it("computeTerminalTargetedCap: effectiveCap = min(20, ceil(0.5 * activeRosterSize))", async () => {
    const { computeTerminalTargetedCap } = await import("@/lib/security/staff-pin-throttle")

    expect(computeTerminalTargetedCap(10)).toBe(5) // ceil(5) = 5, under the 20 cap
    expect(computeTerminalTargetedCap(100)).toBe(20) // clamped to 20 even for large rosters
    expect(computeTerminalTargetedCap(1)).toBe(1) // ceil(0.5) = 1
  })

  it("clearPinAttemptWindow resets missCount to 0 and unblocks the target", async () => {
    const { recordPinAttemptMiss, clearPinAttemptWindow, isPinTargetBlocked } = await import("@/lib/security/staff-pin-throttle")

    for (let i = 0; i < 5; i += 1) {
      await recordPinAttemptMiss({ targetKey: "user:staff_clear", kind: "user" })
    }
    expect((await isPinTargetBlocked("user:staff_clear")).blocked).toBe(true)

    await clearPinAttemptWindow("user:staff_clear")

    const status = await isPinTargetBlocked("user:staff_clear")
    expect(status.blocked).toBe(false)
    expect(status.missCount).toBe(0)
  })

  it("isAnyPinTargetBlocked returns the FIRST blocked status among multiple keys", async () => {
    const { recordPinAttemptMiss, isAnyPinTargetBlocked } = await import("@/lib/security/staff-pin-throttle")

    for (let i = 0; i < 5; i += 1) {
      await recordPinAttemptMiss({ targetKey: "user:staff_multi", kind: "user" })
    }

    const status = await isAnyPinTargetBlocked(["terminal:front-desk", "user:staff_multi"])
    expect(status.blocked).toBe(true)
  })

  it("TERMINAL COOLDOWN SELF-RECOVERY: a stale (>15min) window fully resets cooldownLevel 2 -> 0", async () => {
    const staleWindowStart = new Date(Date.now() - (STAFF_PIN_WINDOW_MS + 60_000))
    store.set("terminal:front-desk:targeted", {
      targetKey: "terminal:front-desk:targeted",
      missCount: 5,
      lifetimeMissCount: 5,
      windowStart: staleWindowStart,
      blockedUntil: null,
      cooldownLevel: 2,
      lockedPermanentlyAt: null,
    })

    const { recordPinAttemptMiss } = await import("@/lib/security/staff-pin-throttle")

    await recordPinAttemptMiss({ targetKey: "terminal:front-desk:targeted", kind: "terminal", effectiveCap: 2 })

    const row = store.get("terminal:front-desk:targeted")
    expect(row!.cooldownLevel).toBe(0)
  })

  it("TERMINAL COOLDOWN SELF-RECOVERY: clearPinAttemptWindow (successful auth) fully resets cooldownLevel 3 -> 0", async () => {
    store.set("terminal:front-desk:targeted", {
      targetKey: "terminal:front-desk:targeted",
      missCount: 5,
      lifetimeMissCount: 5,
      windowStart: new Date(),
      blockedUntil: new Date(Date.now() + 60_000),
      cooldownLevel: 3,
      lockedPermanentlyAt: null,
    })

    const { clearPinAttemptWindow } = await import("@/lib/security/staff-pin-throttle")

    await clearPinAttemptWindow("terminal:front-desk:targeted")

    const row = store.get("terminal:front-desk:targeted")
    expect(row!.cooldownLevel).toBe(0)
    expect(row!.blockedUntil).toBeNull()
  })

  it("TERMINAL COOLDOWN SELF-RECOVERY: never produces a permanent lock across repeated escalate/reset cycles", async () => {
    const { recordPinAttemptMiss, clearPinAttemptWindow } = await import("@/lib/security/staff-pin-throttle")

    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (let i = 0; i < 3; i += 1) {
        await recordPinAttemptMiss({ targetKey: "terminal:kiosk-a:targeted", kind: "terminal", effectiveCap: 2 })
      }
      await clearPinAttemptWindow("terminal:kiosk-a:targeted")
    }

    const row = store.get("terminal:kiosk-a:targeted")
    expect(row!.lockedPermanentlyAt).toBeNull()
    expect(row!.cooldownLevel).toBe(0)
  })
})
