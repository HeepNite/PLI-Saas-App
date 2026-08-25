import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  admitSpecialClassReservation,
  preserveSpecialClassHold,
} from "@/lib/checkout/special-class-reservation"

const input = {
  attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
  dbUserId: "db_user_1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  phone: "+12015550123",
  holdExpiresAt: new Date("2026-08-23T20:30:00.000Z"),
}

const makeTransaction = (countedSpots = 0) => {
  const purchase = {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(countedSpots),
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "purchase_1",
      status: "pending",
      stripeCheckoutSessionId: null,
      amount: args.data.amount,
    })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  }
  const classSession = { upsert: vi.fn().mockResolvedValue({ id: "session_1" }) }
  return { purchase, classSession }
}

describe("special salsa class reservation admission", () => {
  it("extends the countable hold boundary through a still-open Stripe Session expiry", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })

    await preserveSpecialClassHold({
      purchaseId: "purchase_1",
      sessionId: "cs_mismatched",
      currentMetadata: {
        specialEventKey: "special-salsa-class-2026-08-30",
        holdExpiresAt: "2026-08-23T20:30:00.000Z",
      },
      holdExpiresAt: new Date("2026-08-23T20:31:00.999Z"),
    }, {
      db: { purchase: { updateMany } } as never,
    })

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "purchase_1", status: "pending" },
      data: {
        stripeCheckoutSessionId: "cs_mismatched",
        createdAt: new Date("2026-08-23T20:01:00.000Z"),
        metadata: {
          specialEventKey: "special-salsa-class-2026-08-30",
          holdExpiresAt: "2026-08-23T20:31:00.000Z",
        },
      },
    })
  })

  it("creates one fixed pending hold inside a serializable transaction", async () => {
    const tx = makeTransaction()
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }

    const result = await admitSpecialClassReservation(input, { db: db as never, now: () => new Date("2026-08-23T20:00:00.000Z") })

    expect(result).toMatchObject({
      ok: true,
      kind: "created",
      purchase: { id: "purchase_1" },
      holdExpiresAt: new Date("2026-08-23T20:30:00.000Z"),
    })
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" })
    expect(tx.classSession.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ capacity: 40, durationMinutes: 60, location: "54 Coles St, Jersey City" }),
    }))
    expect(tx.purchase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: 2000,
        currency: "usd",
        status: "pending",
        participants: 1,
        createdAt: new Date("2026-08-23T20:00:00.000Z"),
        metadata: expect.objectContaining({ holdExpiresAt: "2026-08-23T20:30:00.000Z" }),
      }),
    }))
  })

  it("returns the same hold for the same attempt", async () => {
    const tx = makeTransaction()
    tx.purchase.findUnique.mockResolvedValue({
      id: "purchase_existing",
      userId: input.dbUserId,
      courseSlug: "special-salsa-calena-2026-08-30",
      status: "pending",
      amount: 2000,
      stripeCheckoutSessionId: "cs_existing",
      createdAt: new Date("2026-08-23T20:00:00.000Z"),
      metadata: { holdExpiresAt: "2026-08-23T20:30:00.000Z" },
    })
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }

    const result = await admitSpecialClassReservation(input, {
      db: db as never,
      now: () => new Date("2026-08-23T20:29:59.999Z"),
    })

    expect(result).toMatchObject({
      ok: true,
      kind: "existing",
      purchase: { id: "purchase_existing" },
      holdExpiresAt: new Date("2026-08-23T20:30:00.000Z"),
    })
    expect(tx.purchase.create).not.toHaveBeenCalled()
  })

  it("preserves a pre-deadline amount when the same attempt is recovered after the deadline", async () => {
    const tx = makeTransaction()
    tx.purchase.findUnique.mockResolvedValue({
      id: "purchase_promotional",
      userId: input.dbUserId,
      courseSlug: "special-salsa-calena-2026-08-30",
      status: "pending",
      amount: 2000,
      stripeCheckoutSessionId: "cs_promotional",
      createdAt: new Date("2026-08-30T13:59:59.000Z"),
      metadata: { holdExpiresAt: "2026-08-30T14:29:59.000Z" },
    })
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }

    const result = await admitSpecialClassReservation({
      ...input,
      holdExpiresAt: new Date("2026-08-30T14:30:00.000Z"),
    }, {
      db: db as never,
      now: () => new Date("2026-08-30T14:00:00.000Z"),
    })

    expect(result).toMatchObject({
      ok: true,
      kind: "existing",
      purchase: { id: "purchase_promotional", amount: 2000 },
    })
    expect(tx.purchase.create).not.toHaveBeenCalled()
    expect(tx.purchase.updateMany).not.toHaveBeenCalled()
  })

  it("invalidates an expired same-attempt hold instead of recovering it", async () => {
    const tx = makeTransaction()
    tx.purchase.findUnique.mockResolvedValue({
      id: "purchase_expired",
      userId: input.dbUserId,
      courseSlug: "special-salsa-calena-2026-08-30",
      status: "pending",
      stripeCheckoutSessionId: "cs_expired",
      createdAt: new Date("2026-08-23T20:00:00.000Z"),
      metadata: { holdExpiresAt: "2026-08-23T20:30:00.000Z" },
    })
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }

    const result = await admitSpecialClassReservation({
      ...input,
      holdExpiresAt: new Date("2026-08-23T21:00:00.000Z"),
    }, {
      db: db as never,
      now: () => new Date("2026-08-23T20:30:00.000Z"),
    })

    expect(result).toEqual({ ok: false, code: "CHECKOUT_EXPIRED" })
    expect(tx.purchase.updateMany).toHaveBeenCalledWith({
      where: { id: "purchase_expired", status: "pending" },
      data: { status: "expired" },
    })
    expect(tx.purchase.create).not.toHaveBeenCalled()
  })

  it.each(["P2002", "P2034"])("retries a concurrent same-attempt %s conflict and returns the existing hold", async (code) => {
    const tx = makeTransaction()
    tx.purchase.findUnique.mockResolvedValue({
      id: "purchase_existing",
      userId: input.dbUserId,
      courseSlug: "special-salsa-calena-2026-08-30",
      status: "pending",
      stripeCheckoutSessionId: "cs_existing",
      createdAt: new Date("2026-08-23T20:00:00.000Z"),
      metadata: { holdExpiresAt: "2026-08-23T20:30:00.000Z" },
    })
    const db = {
      $transaction: vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error("Retryable reservation conflict"), { code }))
        .mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    }

    const result = await admitSpecialClassReservation(input, {
      db: db as never,
      now: () => new Date("2026-08-23T20:29:59.999Z"),
    })

    expect(result).toMatchObject({ ok: true, kind: "existing", purchase: { id: "purchase_existing" } })
    expect(db.$transaction).toHaveBeenCalledTimes(2)
    expect(tx.purchase.create).not.toHaveBeenCalled()
  })

  it("rejects a second active attempt and a completed reservation", async () => {
    const pendingTx = makeTransaction()
    pendingTx.purchase.findFirst.mockResolvedValue({ status: "pending" })
    const pendingDb = { $transaction: vi.fn(async (callback: (client: typeof pendingTx) => unknown) => callback(pendingTx)) }
    await expect(admitSpecialClassReservation(input, {
      db: pendingDb as never,
      now: () => new Date("2026-08-23T20:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      code: "CHECKOUT_IN_PROGRESS",
    })

    const paidTx = makeTransaction()
    paidTx.purchase.findFirst.mockResolvedValue({ status: "paid" })
    const paidDb = { $transaction: vi.fn(async (callback: (client: typeof paidTx) => unknown) => callback(paidTx)) }
    await expect(admitSpecialClassReservation(input, {
      db: paidDb as never,
      now: () => new Date("2026-08-23T20:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      code: "ALREADY_REGISTERED",
    })
  })

  it("admits exactly one of two concurrent requests for the final spot", async () => {
    let countedSpots = 39
    let queue = Promise.resolve()
    const db = {
      $transaction: vi.fn(<T>(callback: (client: ReturnType<typeof makeTransaction>) => Promise<T>) => {
        const run = queue.then(async () => {
          const tx = makeTransaction(countedSpots)
          tx.purchase.count.mockImplementation(async () => countedSpots)
          tx.purchase.create.mockImplementation(async () => {
            countedSpots += 1
            return { id: `purchase_${countedSpots}`, status: "pending", stripeCheckoutSessionId: null }
          })
          return callback(tx)
        })
        queue = run.then(() => undefined, () => undefined)
        return run
      }),
    }

    const [first, second] = await Promise.all([
      admitSpecialClassReservation(input, { db: db as never, now: () => new Date("2026-08-23T20:00:00.000Z") }),
      admitSpecialClassReservation({ ...input, attemptId: "6f4fdf3c-a910-4f72-b8f0-f5637a101d65", dbUserId: "db_user_2" }, {
        db: db as never,
        now: () => new Date("2026-08-23T20:00:00.000Z"),
      }),
    ])

    expect([first, second].filter((result) => result.ok)).toHaveLength(1)
    expect([first, second]).toContainEqual({ ok: false, code: "SOLD_OUT" })
    expect(countedSpots).toBe(40)
  })
})
