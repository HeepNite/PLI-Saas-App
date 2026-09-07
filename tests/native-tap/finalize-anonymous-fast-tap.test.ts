import { describe, expect, it } from "vitest"
import { finalizeAnonymousFastTap } from "@/lib/native-tap/finalize-anonymous-fast-tap"

const STARTS_AT = new Date("2026-08-14T18:00:00.000Z")
type State = {
  job: Record<string, unknown> & { reviewReason: string | null }
  sale: Record<string, unknown> | null
  grant: Record<string, unknown> | null
  saleCreates: number
  grantCreates: number
}
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
const matches = (job: Record<string, unknown>, where: Record<string, unknown>): boolean => {
  if (where.id && job.id !== where.id) return false
  if (typeof where.status === "string" && job.status !== where.status) return false
  if (where.status && typeof where.status === "object" && !(where.status as { in: string[] }).in.includes(job.status as string)) return false
  if (where.reviewReason !== undefined && job.reviewReason !== where.reviewReason) return false
  if (where.OR && !(where.OR as Record<string, unknown>[]).some((clause) => matches(job, clause))) return false
  return where.providerPaymentId === undefined || job.providerPaymentId === where.providerPaymentId
}

class TransactionHarness {
  state: State
  identityAccesses = 0
  failGrant = false
  interleavePaymentWithRefund = false
  private transactions = 0
  private paymentPaused = deferred()
  private refundClaimed = deferred()
  paymentWaiting = this.paymentPaused.promise

  constructor(status = "unknown") {
    this.state = {
      job: {
        id: "job-1", classSessionId: "pinned-class", amountCents: 2500, currency: "usd",
        providerPaymentId: null, status, reviewReason: null, classSession: { startsAt: STARTS_AT },
      },
      sale: null, grant: null, saleCreates: 0, grantCreates: 0,
    }
  }

  $transaction = async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
    const snapshot = structuredClone(this.state)
    const transaction = ++this.transactions
    try {
      return await work(this.tx(transaction))
    } catch (error) {
      if (!this.interleavePaymentWithRefund) this.state = snapshot
      throw error
    }
  }

  private tx(transaction: number) {
    const identity = () => {
      this.identityAccesses += 1
      throw new Error("IDENTITY_MODEL_ACCESSED")
    }
    const pausePayment = async () => {
      if (!this.interleavePaymentWithRefund || transaction !== 1) return
      this.paymentPaused.resolve()
      await this.refundClaimed.promise
    }
    const finishRefundClaim = () => {
      if (this.interleavePaymentWithRefund && transaction === 2) this.refundClaimed.resolve()
    }
    return {
      get user() { return identity() },
      get attendance() { return identity() },
      nativePaymentJob: {
        findUnique: async () => structuredClone(this.state.job),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(this.state.job, data)
          finishRefundClaim()
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          await pausePayment()
          const count = matches(this.state.job, where) ? 1 : 0
          if (count) Object.assign(this.state.job, data)
          finishRefundClaim()
          return { count }
        },
      },
      anonymousSale: {
        upsert: async ({ create }: { create: Record<string, unknown> }) => {
          await pausePayment()
          if (!this.state.sale) {
            this.state.sale = create
            this.state.saleCreates += 1
          }
          return this.state.sale
        },
        update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(this.state.sale!, data),
      },
      anonymousAttendanceGrant: {
        upsert: async ({ create }: { create: Record<string, unknown> }) => {
          if (this.failGrant) throw new Error("GRANT_WRITE_FAILED")
          if (!this.state.grant) {
            this.state.grant = create
            this.state.grantCreates += 1
          }
          return this.state.grant
        },
        deleteMany: async () => {
          const count = this.state.grant ? 1 : 0
          this.state.grant = null
          return { count }
        },
      },
    }
  }
}

const payment = (providerPaymentId = "pi_confirmed") => ({
  authority: "server" as const, type: "payment_confirmed" as const, paymentJobId: "job-1", providerPaymentId,
})
const refund = (providerRefundId = "re_1") => ({
  authority: "server" as const, type: "refund_confirmed" as const, paymentJobId: "job-1", providerRefundId,
  reason: "requested_by_customer", source: "stripe_webhook",
})
const finalizePayment = (db: TransactionHarness) => finalizeAnonymousFastTap(payment(), {
  db: db as never, now: () => new Date("2026-08-14T17:00:00.000Z"),
})

describe("finalizeAnonymousFastTap", () => {
  it("atomically finalizes authoritative payment with pinned terms exactly once across concurrent retries", async () => {
    const db = new TransactionHarness("client_succeeded")
    await Promise.all([finalizePayment(db), finalizePayment(db)])
    expect(db.state.sale).toMatchObject({ paymentJobId: "job-1", amountCents: 2500, currency: "usd", status: "paid" })
    expect(db.state.grant).toMatchObject({ paymentJobId: "job-1", sessionId: "pinned-class" })
    expect(db.state).toMatchObject({ saleCreates: 1, grantCreates: 1 })
    expect(db.state.job).toMatchObject({ providerPaymentId: "pi_confirmed", status: "finalized" })
    expect(db.identityAccesses).toBe(0)
  })

  it("does not let a stale payment retry overwrite a concurrently committed refund", async () => {
    const db = new TransactionHarness("finalized")
    Object.assign(db.state, {
      sale: { paymentJobId: "job-1", status: "paid" },
      grant: { paymentJobId: "job-1", sessionId: "pinned-class" },
    })
    db.state.job.providerPaymentId = "pi_confirmed"
    db.interleavePaymentWithRefund = true
    const paymentRetry = finalizePayment(db)
    await db.paymentWaiting
    const refundAttempt = finalizeAnonymousFastTap(refund(), { db: db as never, now: () => STARTS_AT })
    const [paymentResult, refundResult] = await Promise.allSettled([paymentRetry, refundAttempt])
    expect(paymentResult).toMatchObject({ status: "rejected", reason: { message: "CONFLICTING_PAYMENT_STATE" } })
    expect(refundResult.status).toBe("fulfilled")
    expect(db.state.job.status).toBe("refunded")
    expect(db.state.sale).toMatchObject({ status: "refunded" })
    expect(db.state.grant).toBeNull()
  })

  it("rejects client and conflicting provider evidence without changing the atomic result", async () => {
    const db = new TransactionHarness()
    await expect(finalizeAnonymousFastTap({ ...payment(), authority: "client" }, { db: db as never })).rejects.toThrow("AUTHORITATIVE_EVIDENCE_REQUIRED")
    await finalizePayment(db)
    await expect(finalizeAnonymousFastTap(payment("pi_conflict"), { db: db as never })).rejects.toThrow("CONFLICTING_PAYMENT_EVIDENCE")
    expect(db.state).toMatchObject({ saleCreates: 1, grantCreates: 1 })
  })

  it("rolls back the sale when the grant write fails", async () => {
    const db = new TransactionHarness()
    db.failGrant = true
    await expect(finalizePayment(db)).rejects.toThrow("GRANT_WRITE_FAILED")
    expect(db.state.sale).toBeNull()
    expect(db.state.grant).toBeNull()
    expect(db.state.job.status).toBe("unknown")
  })

  it.each([
    ["before class start", new Date("2026-08-14T17:59:59.000Z")],
    ["at 30 elapsed minutes", new Date("2026-08-14T18:30:00.000Z")],
  ])("refund %s revokes only the anonymous grant", async (_label, requestedAt) => {
    const db = new TransactionHarness()
    await finalizePayment(db)
    await finalizeAnonymousFastTap(refund(), { db: db as never, now: () => requestedAt })
    expect(db.state.sale).toMatchObject({ status: "refunded", refundedAt: requestedAt })
    expect(db.state.grant).toBeNull()
    expect(db.identityAccesses).toBe(0)
  })

  it("refund after 30 minutes retains the grant and preserves first-observed audited evidence on retry", async () => {
    const db = new TransactionHarness()
    await finalizePayment(db)
    const firstObserved = new Date("2026-08-14T18:30:00.001Z")
    await finalizeAnonymousFastTap(refund(), { db: db as never, now: () => firstObserved })
    await finalizeAnonymousFastTap(refund(), { db: db as never, now: () => new Date("2026-08-14T19:00:00.000Z") })
    expect(db.state.grant).toMatchObject({ paymentJobId: "job-1", sessionId: "pinned-class" })
    expect(db.state).toMatchObject({ saleCreates: 1, grantCreates: 1 })
    expect(JSON.parse(db.state.job.reviewReason!)).toMatchObject({
      providerRefundId: "re_1", requestedAt: firstObserved.toISOString(),
      reason: "requested_by_customer", source: "stripe_webhook",
    })
  })

  it("rejects a malformed persisted refund requestedAt as a controlled domain error", async () => {
    const db = new TransactionHarness()
    await finalizePayment(db)
    db.state.job.reviewReason = JSON.stringify({ providerRefundId: "re_1", requestedAt: "not-a-date" })
    await expect(finalizeAnonymousFastTap(refund(), { db: db as never, now: () => STARTS_AT })).rejects.toThrow("INVALID_REFUND_AUDIT")
    expect(db.state.job.status).toBe("finalized")
    expect(db.state.sale).toMatchObject({ status: "paid" })
    expect(db.state.grant).toMatchObject({ sessionId: "pinned-class" })
  })
})
