import {
  getTerminalAttemptsRemaining,
  resolveKioskPinThrottleSeverity,
  resolveTerminalMissWindowActive,
  STUDENT_PIN_TERMINAL_BLOCK_MS,
  STUDENT_PIN_TERMINAL_COOLDOWN_MS,
  STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD,
  STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD,
} from "@/lib/security/kiosk-pin-throttle"
import type { StudentPinDbClient, StudentPinTerminalThrottleState } from "./pin-lifecycle"

export const isTerminalBlocked = async (
  tx: StudentPinDbClient,
  terminalId: string,
  now = new Date()
): Promise<StudentPinTerminalThrottleState> => {
  const counter = await tx.kioskTerminalMissCounter.findUnique({
    where: { terminalId },
  })

  if (!counter) {
    return {
      blocked: false,
      terminalBlocked: false,
      cooldownActive: false,
      blockedUntil: null,
      attemptsRemaining: getTerminalAttemptsRemaining(0),
      missCount: 0,
    }
  }

  const blocked = Boolean(counter.blockedUntil && counter.blockedUntil > now)
  const withinWindow = resolveTerminalMissWindowActive(counter.windowStart, now)
  const missCount = withinWindow ? counter.missCount : 0
  const severity = resolveKioskPinThrottleSeverity({ missCount, blockedUntil: blocked ? counter.blockedUntil : null, now })

  return {
    blocked: severity === "cooldown" || severity === "emergency",
    terminalBlocked: severity === "emergency",
    cooldownActive: severity === "cooldown",
    blockedUntil: blocked ? counter.blockedUntil : null,
    attemptsRemaining: blocked ? 0 : getTerminalAttemptsRemaining(missCount),
    missCount,
  }
}

export const clearTerminalMisses = async (tx: StudentPinDbClient, terminalId: string) => {
  await tx.kioskTerminalMissCounter.deleteMany({
    where: { terminalId },
  })
}

export const recordTerminalMiss = async (tx: StudentPinDbClient, terminalId: string, now = new Date()) => {
  const existing = await tx.kioskTerminalMissCounter.findUnique({
    where: { terminalId },
  })

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      blocked: true,
      terminalBlocked: existing.missCount >= STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD,
      cooldownActive: existing.missCount >= STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD,
      blockedUntil: existing.blockedUntil,
      attemptsRemaining: 0,
      missCount: existing.missCount,
    }
  }

  const withinWindow = existing ? resolveTerminalMissWindowActive(existing.windowStart, now) : false
  const nextMissCount = existing && withinWindow ? existing.missCount + 1 : 1
  const blockedUntil =
    nextMissCount >= STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD
      ? new Date(now.getTime() + STUDENT_PIN_TERMINAL_BLOCK_MS)
      : nextMissCount >= STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD
        ? new Date(now.getTime() + STUDENT_PIN_TERMINAL_COOLDOWN_MS)
        : null

  const counter = existing
    ? await tx.kioskTerminalMissCounter.update({
        where: { terminalId },
        data: {
          missCount: nextMissCount,
          windowStart: withinWindow ? existing.windowStart : now,
          blockedUntil,
        },
      })
    : await tx.kioskTerminalMissCounter.create({
        data: {
          terminalId,
          missCount: nextMissCount,
          windowStart: now,
          blockedUntil,
        },
      })

  return {
    blocked: Boolean(counter.blockedUntil && counter.blockedUntil > now),
    terminalBlocked: nextMissCount >= STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD,
    cooldownActive:
      nextMissCount >= STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD &&
      nextMissCount < STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD,
    blockedUntil: counter.blockedUntil,
    attemptsRemaining:
      counter.blockedUntil && counter.blockedUntil > now
        ? 0
        : getTerminalAttemptsRemaining(counter.missCount),
    missCount: counter.missCount,
  }
}
