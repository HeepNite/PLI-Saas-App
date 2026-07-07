import { prisma } from "@/lib/prisma"

/**
 * Persistent, atomic-increment-then-evaluate throttle for the staff PIN
 * routes (login/pin, checkin/pin, terminal/session) — design v5 ADR 9/10/15.
 *
 * Deliberately keyed on server-derived identity (victim user id or terminal
 * slug), NEVER on client-supplied `x-forwarded-for`. Rotating that header
 * has zero effect on lockout because the key never includes it.
 *
 * Atomicity: every mutating call is a SINGLE `prisma.staffPinAttemptCounter`
 * call using the `{ increment }` operator (an atomic `UPDATE ... RETURNING`
 * at the Postgres level) — never a separate read-then-write pair. This is
 * what keeps `missCount` correct under concurrent bursts (no lost updates).
 */

export const STAFF_PIN_WINDOW_MS = 15 * 60 * 1000
export const STAFF_PIN_COOLDOWN_THRESHOLD = 5
export const STAFF_PIN_COOLDOWN_MS = 5 * 60 * 1000
export const STAFF_PIN_HARD_THRESHOLD = 10
export const STAFF_PIN_HARD_BLOCK_MS = 30 * 60 * 1000
export const STAFF_PIN_USER_LIFETIME_CAP = 50

// Self-recovering escalating cooldown ladder for terminal:{slug} and
// terminal:{slug}:targeted keys — NEVER a permanent lock (design ADR 9/15).
export const TERMINAL_COOLDOWN_LADDER_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 24 * 60 * 60_000]

// Concrete starting cap for the terminal:{slug}:targeted enumeration guard
// (design ADR 15): effectiveCap = min(20, ceil(0.5 * activeRosterSize)).
export const TERMINAL_TARGETED_BASE_CAP = 20

export const computeTerminalTargetedCap = (activeRosterSize: number): number =>
  Math.min(TERMINAL_TARGETED_BASE_CAP, Math.ceil(0.5 * Math.max(0, activeRosterSize)))

export type PinThrottleKind = "user" | "terminal"

export type RecordMissOptions = {
  targetKey: string
  kind: PinThrottleKind
  /**
   * Overrides the trip threshold for this call. Used for the
   * terminal:{slug}:targeted aggregate key (ADR 15). Ignored for kind
   * "user"; defaults to STAFF_PIN_COOLDOWN_THRESHOLD for plain terminal keys.
   */
  effectiveCap?: number
}

export type PinThrottleStatus = {
  blocked: boolean
  retryAfterSec: number | null
  reason: string | null
  missCount: number
  lifetimeMissCount: number
}

const secondsUntil = (date: Date): number => Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000))

const notBlocked = (missCount = 0, lifetimeMissCount = 0): PinThrottleStatus => ({
  blocked: false,
  retryAfterSec: null,
  reason: null,
  missCount,
  lifetimeMissCount,
})

/**
 * Atomically resets a stale (>15min old) window to a clean slate. Uses a
 * conditional `updateMany` so concurrent callers never race a read-then-write
 * reset: whichever call's WHERE clause still matches "wins" the reset: once
 * one succeeds, windowStart is no longer stale for the others.
 */
const resetWindowIfStale = async (targetKey: string): Promise<void> => {
  const cutoff = new Date(Date.now() - STAFF_PIN_WINDOW_MS)
  await prisma.staffPinAttemptCounter.updateMany({
    where: { targetKey, windowStart: { lt: cutoff } },
    data: { missCount: 0, windowStart: new Date(), blockedUntil: null },
  })
}

const applyPolicyAfterMiss = async (
  targetKey: string,
  counter: { missCount: number; lifetimeMissCount: number; cooldownLevel: number },
  kind: PinThrottleKind,
  effectiveCap?: number
): Promise<PinThrottleStatus> => {
  if (kind === "user") {
    if (counter.lifetimeMissCount >= STAFF_PIN_USER_LIFETIME_CAP) {
      await prisma.staffPinAttemptCounter.update({
        where: { targetKey },
        data: { lockedPermanentlyAt: new Date() },
      })
      return {
        blocked: true,
        retryAfterSec: null,
        reason: "This staff PIN is permanently locked after repeated failed attempts. An admin must unlock it.",
        missCount: counter.missCount,
        lifetimeMissCount: counter.lifetimeMissCount,
      }
    }
    if (counter.missCount >= STAFF_PIN_HARD_THRESHOLD) {
      const blockedUntil = new Date(Date.now() + STAFF_PIN_HARD_BLOCK_MS)
      await prisma.staffPinAttemptCounter.update({ where: { targetKey }, data: { blockedUntil } })
      return {
        blocked: true,
        retryAfterSec: secondsUntil(blockedUntil),
        reason: "Too many failed PIN attempts. Please try again later.",
        missCount: counter.missCount,
        lifetimeMissCount: counter.lifetimeMissCount,
      }
    }
    if (counter.missCount >= STAFF_PIN_COOLDOWN_THRESHOLD) {
      const blockedUntil = new Date(Date.now() + STAFF_PIN_COOLDOWN_MS)
      await prisma.staffPinAttemptCounter.update({ where: { targetKey }, data: { blockedUntil } })
      return {
        blocked: true,
        retryAfterSec: secondsUntil(blockedUntil),
        reason: "Too many failed PIN attempts. Please try again in a few minutes.",
        missCount: counter.missCount,
        lifetimeMissCount: counter.lifetimeMissCount,
      }
    }
    return notBlocked(counter.missCount, counter.lifetimeMissCount)
  }

  // kind === "terminal" — covers both terminal:{slug} and terminal:{slug}:targeted.
  // Self-recovering escalating cooldown, NEVER a permanent lock.
  const cap = effectiveCap ?? STAFF_PIN_COOLDOWN_THRESHOLD
  if (counter.missCount >= cap) {
    const nextLevel = Math.min(counter.cooldownLevel + 1, TERMINAL_COOLDOWN_LADDER_MS.length - 1)
    const durationMs = TERMINAL_COOLDOWN_LADDER_MS[nextLevel]!
    const blockedUntil = new Date(Date.now() + durationMs)
    await prisma.staffPinAttemptCounter.update({
      where: { targetKey },
      data: { blockedUntil, cooldownLevel: nextLevel },
    })
    return {
      blocked: true,
      retryAfterSec: secondsUntil(blockedUntil),
      reason: "This terminal is temporarily locked after repeated failed attempts.",
      missCount: counter.missCount,
      lifetimeMissCount: counter.lifetimeMissCount,
    }
  }
  return notBlocked(counter.missCount, counter.lifetimeMissCount)
}

/**
 * Records one failed PIN attempt against `targetKey` and evaluates whether
 * the target should now be blocked. The increment itself is a single atomic
 * Prisma `upsert` call — safe under concurrent bursts (see module doc).
 */
export const recordPinAttemptMiss = async ({ targetKey, kind, effectiveCap }: RecordMissOptions): Promise<PinThrottleStatus> => {
  await resetWindowIfStale(targetKey)

  const counter = await prisma.staffPinAttemptCounter.upsert({
    where: { targetKey },
    create: { targetKey, missCount: 1, lifetimeMissCount: 1, windowStart: new Date() },
    update: { missCount: { increment: 1 }, lifetimeMissCount: { increment: 1 } },
  })

  return applyPolicyAfterMiss(targetKey, counter, kind, effectiveCap)
}

/** Read-only check — does NOT record an attempt. Used as the early-exit gate before a hash compare. */
export const isPinTargetBlocked = async (targetKey: string): Promise<PinThrottleStatus> => {
  const counter = await prisma.staffPinAttemptCounter.findUnique({ where: { targetKey } })
  if (!counter) return notBlocked()

  if (counter.lockedPermanentlyAt) {
    return {
      blocked: true,
      retryAfterSec: null,
      reason: "This staff PIN is permanently locked after repeated failed attempts. An admin must unlock it.",
      missCount: counter.missCount,
      lifetimeMissCount: counter.lifetimeMissCount,
    }
  }
  if (counter.blockedUntil && counter.blockedUntil.getTime() > Date.now()) {
    return {
      blocked: true,
      retryAfterSec: secondsUntil(counter.blockedUntil),
      reason: "Too many failed attempts. Please wait before trying again.",
      missCount: counter.missCount,
      lifetimeMissCount: counter.lifetimeMissCount,
    }
  }
  return notBlocked(counter.missCount, counter.lifetimeMissCount)
}

/** Checks multiple throttle keys (e.g. victim + terminal aggregate) and returns the first blocked one. */
export const isAnyPinTargetBlocked = async (targetKeys: string[]): Promise<PinThrottleStatus> => {
  for (const key of targetKeys) {
    const status = await isPinTargetBlocked(key)
    if (status.blocked) return status
  }
  return notBlocked()
}

/** Clears the current window's misses on a successful hit. Does not touch lifetime/permanent-lock state. */
export const clearPinAttemptWindow = async (targetKey: string): Promise<void> => {
  await prisma.staffPinAttemptCounter.updateMany({
    where: { targetKey },
    data: { missCount: 0, windowStart: new Date(), blockedUntil: null },
  })
}
