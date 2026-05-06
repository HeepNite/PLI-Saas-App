import type { PrismaClient } from "@prisma/client"

/**
 * P0 on-demand auto-closure for open StaffClockEntry records.
 *
 * Closure formula:
 *   closureAt = min(now, expectedClockOutAt + graceMinutes, clockInAt + maxDailyMinutes)
 *
 * Idempotent: already-closed entries (actualClockOutAt != null) are never touched.
 */

// P0 policy defaults
export const GRACE_MINUTES = 15
export const MAX_DAILY_PAYABLE_MINUTES = 600 // 10 hours
export const OVERTIME_THRESHOLD_MINUTES = 15

const MILLISECONDS_PER_MINUTE = 60_000

export type ClosureReason =
  | "on_demand_expected_grace"
  | "on_demand_daily_cap"
  | "on_demand_now_guardrail"
  | "manual_checkout"

export interface ClosurePolicySnapshot {
  graceMinutes: number
  maxDailyPayableMinutes: number
  overtimeThresholdMinutes: number
}

export type ClosureSource =
  | "payroll-read-entries"
  | "payroll-run-payday"
  | "payroll-me"

export interface ClosureResult {
  closedCount: number
  entryIds: string[]
}

/**
 * Computes the deterministic closure timestamp for an open entry.
 *
 * @param clockInAt — when the staff checked in
 * @param expectedClockOutAt — schedule anchor (may be missing/invalid)
 * @param now — current time (injectable for testing)
 * @returns closureAt + reason
 */
export function computeClosureTimestamp(
  clockInAt: Date,
  expectedClockOutAt: Date | null | undefined,
  now: Date = new Date(),
): { closureAt: Date; reason: ClosureReason } {
  const dailyCapAt = new Date(
    clockInAt.getTime() + MAX_DAILY_PAYABLE_MINUTES * MILLISECONDS_PER_MINUTE,
  )

  // Fallback guardrail: missing/invalid/zero-duration expected anchor
  if (
    !expectedClockOutAt ||
    isNaN(expectedClockOutAt.getTime()) ||
    expectedClockOutAt.getTime() <= clockInAt.getTime()
  ) {
    if (now.getTime() < dailyCapAt.getTime()) {
      return { closureAt: now, reason: "on_demand_now_guardrail" }
    }
    return { closureAt: dailyCapAt, reason: "on_demand_daily_cap" }
  }

  const graceAt = new Date(
    expectedClockOutAt.getTime() + GRACE_MINUTES * MILLISECONDS_PER_MINUTE,
  )

  // min(now, graceAt, dailyCapAt)
  let closureAt = now
  let reason: ClosureReason = "on_demand_now_guardrail"

  if (graceAt.getTime() < closureAt.getTime()) {
    closureAt = graceAt
    reason = "on_demand_expected_grace"
  }

  if (dailyCapAt.getTime() < closureAt.getTime()) {
    closureAt = dailyCapAt
    reason = "on_demand_daily_cap"
  }

  // Sanity: never before clockInAt
  if (closureAt.getTime() < clockInAt.getTime()) {
    closureAt = clockInAt
    reason = "on_demand_now_guardrail"
  }

  return { closureAt, reason }
}

/**
 * Idempotent on-demand closure of open StaffClockEntry records.
 *
 * Finds entries where actualClockOutAt is null and closes them
 * using the deterministic P0 formula. Already-closed entries
 * are never mutated.
 *
 * @param prisma — PrismaClient instance
 * @param options.staffAccountId — scope to a single staff member (optional)
 * @param options.periodStart — scope to entries clocked in on or after this date (optional)
 * @param options.periodEnd — scope to entries clocked in before this date (optional)
 * @param options.source — audit trail: which payroll path triggered this closure
 * @param options.now — injectable clock for testing
 */
export async function closeOpenClockEntriesForPayroll(
  prisma: PrismaClient,
  options: {
    staffAccountId?: string
    periodStart?: Date
    periodEnd?: Date
    source: ClosureSource
    now?: Date
  },
): Promise<ClosureResult> {
  const { staffAccountId, periodStart, periodEnd, source, now = new Date() } = options

  // Build where clause: only open entries (actualClockOutAt is null)
  const where: Record<string, unknown> = {
    actualClockOutAt: null,
  }

  if (staffAccountId) {
    where.staffAccountId = staffAccountId
  }

  if (periodStart) {
    where.clockInAt = { ...(where.clockInAt as Record<string, unknown>), gte: periodStart }
  }

  if (periodEnd) {
    where.clockInAt = { ...(where.clockInAt as Record<string, unknown>), lt: periodEnd }
  }

  // Find all open entries in scope
  const openEntries = await prisma.staffClockEntry.findMany({
    where: where as Parameters<typeof prisma.staffClockEntry.findMany>[0]["where"],
    select: {
      id: true,
      staffAccountId: true,
      clockInAt: true,
      expectedClockOutAt: true,
    },
  })

  if (openEntries.length === 0) {
    return { closedCount: 0, entryIds: [] }
  }

  const policy: ClosurePolicySnapshot = {
    graceMinutes: GRACE_MINUTES,
    maxDailyPayableMinutes: MAX_DAILY_PAYABLE_MINUTES,
    overtimeThresholdMinutes: OVERTIME_THRESHOLD_MINUTES,
  }

  const closedIds: string[] = []

  // Close each entry deterministically
  for (const entry of openEntries) {
    const { closureAt, reason } = computeClosureTimestamp(
      entry.clockInAt,
      entry.expectedClockOutAt,
      now,
    )

    // Preserve any existing metadata, add closure audit fields
    const existingMeta = await prisma.staffClockEntry.findUnique({
      where: { id: entry.id },
      select: { metadata: true },
    })

    const existingMetadata =
      existingMeta?.metadata && typeof existingMeta.metadata === "object"
        ? (existingMeta.metadata as Record<string, unknown>)
        : {}

    const updatedMetadata = {
      ...existingMetadata,
      closureReason: reason,
      autoClosedAt: now.toISOString(),
      closureSource: source,
      policySnapshot: policy,
    }

    await prisma.staffClockEntry.update({
      where: {
        id: entry.id,
        // Race-condition guard: only update if still open
        actualClockOutAt: null,
      },
      data: {
        actualClockOutAt: closureAt,
        status: "clocked_out",
        metadata: updatedMetadata,
      },
    })

    closedIds.push(entry.id)
  }

  return { closedCount: closedIds.length, entryIds: closedIds }
}
