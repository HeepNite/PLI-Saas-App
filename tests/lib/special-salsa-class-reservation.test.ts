import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { admitSpecialClassReservation, getSpecialClassAvailability } from "@/lib/checkout/special-class-reservation"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

const now = new Date("2026-08-27T12:00:00.000Z")
const input = { attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2", specialClassSlug: "bachata-workshop", dbUserId: "user-1", email: "ada@example.com", name: "Ada", phone: "+12015550123" }
const specialClass = { id: "class-1", slug: "bachata-workshop", status: "published", title: "Bachata", description: "Workshop", coverImageUrl: null, priceCents: 2500, currency: "usd", classSessionId: "session-1", salesOpenAt: null, salesCloseAt: null, classSession: { courseSlug: "bachata-workshop", startsAt: new Date("2026-08-28T12:00:00.000Z"), durationMinutes: 60, capacity: 1, location: "PLI" } }

const makeDb = (overrides: { sameAttempt?: unknown; duplicate?: unknown; occupied?: number; webOccupied?: number; resolvedClass?: typeof specialClass } = {}) => {
  const purchase = {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    findUnique: vi.fn().mockResolvedValue(overrides.sameAttempt ?? null),
    findFirst: vi.fn().mockResolvedValue(overrides.duplicate ?? null),
    count: vi.fn()
      .mockResolvedValueOnce(overrides.occupied ?? 0)
      .mockResolvedValue(overrides.webOccupied ?? overrides.occupied ?? 0),
    create: vi.fn().mockImplementation(async ({ data }) => ({ id: "purchase-1", stripeCheckoutSessionId: null, ...data })),
  }
  const tx = { specialClass: { findUnique: vi.fn().mockResolvedValue(overrides.resolvedClass ?? specialClass) }, purchase, $queryRaw: vi.fn().mockResolvedValue([]) }
  return { tx, db: { $transaction: vi.fn(async (callback) => callback(tx)) } }
}

describe("generic special class reservation admission", () => {
  it("creates one attendee hold expiring exactly three minutes after admission", async () => {
    const { tx, db } = makeDb()
    const result = await admitSpecialClassReservation(input, { db: db as never, now: () => now })
    expect(result).toMatchObject({ ok: true, kind: "created", holdExpiresAt: new Date("2026-08-27T12:03:00.000Z") })
    expect(tx.purchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({ participants: 1, specialClassId: "class-1", classSessionId: "session-1", holdExpiresAt: new Date("2026-08-27T12:03:00.000Z") }) })
  })

  it("expires stale holds before checking capacity", async () => {
    const { tx, db } = makeDb()
    await admitSpecialClassReservation(input, { db: db as never, now: () => now })
    expect(tx.purchase.updateMany).toHaveBeenCalledWith({ where: { specialClassId: "class-1", status: "pending", holdExpiresAt: { lte: now } }, data: { status: "expired" } })
  })

  it("reuses the same active attempt without another capacity claim", async () => {
    const holdExpiresAt = new Date("2026-08-27T12:03:00.000Z")
    const { tx, db } = makeDb({ sameAttempt: { id: "purchase-1", userId: "user-1", specialClassId: "class-1", status: "pending", holdExpiresAt, amount: 2500, stripeCheckoutSessionId: "cs_1" } })
    const result = await admitSpecialClassReservation(input, { db: db as never, now: () => now })
    expect(result).toMatchObject({ ok: true, kind: "existing", holdExpiresAt })
    expect(tx.purchase.create).not.toHaveBeenCalled()
  })

  it("rejects a duplicate attendee and a sold-out session", async () => {
    const duplicate = makeDb({ duplicate: { status: "paid" } })
    await expect(admitSpecialClassReservation(input, { db: duplicate.db as never, now: () => now })).resolves.toEqual({ ok: false, code: "ALREADY_REGISTERED" })
    const soldOut = makeDb({ occupied: 1 })
    await expect(admitSpecialClassReservation(input, { db: soldOut.db as never, now: () => now })).resolves.toEqual({ ok: false, code: "SOLD_OUT" })
  })

  it("locks the active Salsa promotion amount server-side for display/charge parity", async () => {
    const salsaClass = { ...specialClass, id: "salsa-class", slug: SPECIAL_SALSA_CLASS.key, priceCents: SPECIAL_SALSA_CLASS.amountCents, classSession: { ...specialClass.classSession, courseSlug: SPECIAL_SALSA_CLASS.courseSlug } }
    const { tx, db } = makeDb({ resolvedClass: salsaClass })
    await admitSpecialClassReservation({ ...input, specialClassSlug: SPECIAL_SALSA_CLASS.key }, { db: db as never, now: () => now })
    expect(tx.purchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: SPECIAL_SALSA_CLASS.promotion.amountCents }) })
  })

  it("rejects the 18th web seat but ignores established cash-channel purchases", async () => {
    const salsaClass = { ...specialClass, slug: SPECIAL_SALSA_CLASS.key, classSession: { ...specialClass.classSession, capacity: 40 } }
    const full = makeDb({ resolvedClass: salsaClass, occupied: 17, webOccupied: 17 })
    await expect(admitSpecialClassReservation({ ...input, specialClassSlug: SPECIAL_SALSA_CLASS.key }, { db: full.db as never, now: () => now })).resolves.toEqual({ ok: false, code: "SOLD_OUT" })

    const cashPresent = makeDb({ resolvedClass: salsaClass, occupied: 17, webOccupied: 9 })
    await expect(admitSpecialClassReservation({ ...input, specialClassSlug: SPECIAL_SALSA_CLASS.key }, { db: cashPresent.db as never, now: () => now })).resolves.toMatchObject({ ok: true })
    expect(cashPresent.tx.purchase.count).toHaveBeenLastCalledWith({ where: expect.objectContaining({ NOT: expect.any(Object) }) })
  })

  it.each([
    ["paid web purchases", { total: 9, held: 0, paid: 9 }, 8],
    ["active web holds", { total: 11, held: 2, paid: 9 }, 6],
    ["cash walk-ins", { total: 10, held: 0, paid: 9 }, 8],
    ["venue capacity", { total: 40, held: 0, paid: 9 }, 0],
  ])("reports real online availability with %s", async (_label, counts, remaining) => {
    const count = vi.fn()
      .mockResolvedValueOnce(counts.total)
      .mockResolvedValueOnce(counts.held)
      .mockResolvedValueOnce(counts.paid)
    const db = {
      specialClass: { findUnique: vi.fn().mockResolvedValue({ ...specialClass, slug: SPECIAL_SALSA_CLASS.key, classSession: { ...specialClass.classSession, capacity: 40 } }) },
      purchase: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), count },
    }

    await expect(getSpecialClassAvailability(SPECIAL_SALSA_CLASS.key, now, db as never)).resolves.toMatchObject({ capacity: 17, remaining, held: counts.held, paid: counts.paid })
    expect(count.mock.calls.slice(1).every(([query]) => Object.hasOwn(query.where, "NOT"))).toBe(true)
    expect(JSON.stringify(count.mock.calls)).not.toMatch(/expired|failed|released/)
  })
})
