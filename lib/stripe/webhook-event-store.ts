import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Interim stale-claim cutoff for `claimStripeWebhookEvent`'s reclaim path.
 *
 * (TODO: set from measured p99 processing latency for `processPaidStripeEvent`
 * — see task 7.1, gated on the open Railway DB connection-limit issue, since
 * connection-pool contention is a major contributor to tail latency and this
 * value cannot be sized responsibly until that is resolved. Must also be sized
 * against Stripe's own retry backoff cadence — see design §3.)
 *
 * Conservative interim value: 5 minutes. `processPaidStripeEvent` does several
 * sequential DB round-trips (purchase upsert, optional consecutive-child
 * transaction, package sync, one or two attendance syncs, points award) but
 * has no long-running external calls in its hot path, so 5 minutes is far
 * longer than any healthy run is expected to take while still being short
 * enough to recover a genuinely-dead worker well within Stripe's multi-day
 * retry window.
 */
const STALE_MS = 5 * 60 * 1000

export type ClaimResult = "claimed" | "duplicate" | "in-flight"

const isP2002 = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

/**
 * Claim-then-process lock for a Stripe webhook event, per design §3.
 *
 * Uses the `eventId` unique constraint as the race-free lock:
 * 1. Try to `create` a fresh row — succeeds on first delivery of a new event.
 * 2. On P2002 (row already exists), attempt ONE atomic conditional reclaim
 *    via `updateMany`, matching only rows that are `"failed"` (a prior attempt
 *    threw) or `"processing"` but stale (the prior worker is presumed dead).
 *    Deliberately excludes `"legacy"` and `"completed"` rows — those are
 *    genuine duplicates, never auto-reclaimed.
 * 3. If the reclaim matched nothing, read the existing row to decide whether
 *    it is a genuine duplicate or another worker's fresh in-flight claim.
 */
export async function claimStripeWebhookEvent(eventId: string, eventType: string): Promise<ClaimResult> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: { eventId, eventType, status: "processing" },
    })
    return "claimed"
  } catch (err) {
    if (!isP2002(err)) throw err
  }

  const now = new Date()
  const staleCutoff = new Date(now.getTime() - STALE_MS)

  const result = await prisma.stripeWebhookEvent.updateMany({
    where: {
      eventId,
      OR: [{ status: "failed" }, { status: "processing", updatedAt: { lt: staleCutoff } }],
    },
    data: { status: "processing", attempts: { increment: 1 }, updatedAt: now },
  })

  if (result.count === 1) {
    return "claimed"
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { eventId } })
  if (existing?.status === "completed" || existing?.status === "legacy") {
    return "duplicate"
  }
  // Fresh "processing" (not stale) — another worker genuinely owns this claim right now.
  return "in-flight"
}

/** Marks the row completed after processing succeeds (design §3/§4). */
export async function completeStripeWebhookEvent(eventId: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({
    where: { eventId },
    data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
  })
}

/** Marks the row failed so a redelivery can be reclaimed via `claimStripeWebhookEvent` (design §3/§4). */
export async function markStripeWebhookEventFailed(eventId: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({
    where: { eventId },
    data: { status: "failed", updatedAt: new Date() },
  })
}

/**
 * Best-effort liveness signal for a long-running claim (design §3, ADR-3).
 * Failures are logged, never thrown — a heartbeat write failure must not
 * abort otherwise-successful business processing.
 */
export async function touchStripeWebhookEventHeartbeat(eventId: string): Promise<void> {
  try {
    await prisma.stripeWebhookEvent.updateMany({
      where: { eventId },
      data: { updatedAt: new Date() },
    })
  } catch (err) {
    console.warn("Stripe webhook heartbeat write failed", { eventId, err })
  }
}
