import { randomInt } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPin, isValidPinHash } from "@/lib/security/staff-pin-hash"

/**
 * Single-use SMS OTP enrollment challenge (design v5 ADR 13 fallback —
 * OUT-OF-BAND SMS nonce, chosen over Clerk session reverification for this
 * apply batch: no server-side SMS sender existed before this PR, and Clerk's
 * `attemptSecondFactorVerification` reverification family is public-beta).
 *
 * Reuses the shared PIN hash module (lib/security/staff-pin-hash.ts) so the
 * code is NEVER stored in plaintext — `hashPin`/`isValidPinHash` are
 * digit-length-agnostic (the 4-digit constraint lives in the PIN resolver,
 * not the hash module), so they apply cleanly to a 6-digit OTP too.
 *
 * Invariant enforced here: at most ONE active (unconsumed + unexpired)
 * challenge per staffUserId at a time. Issuing a new challenge invalidates
 * any prior active one — this keeps the SMS-cost gate (staff-pin-throttle,
 * enroll:{authUserId} key) and the consume step aligned to a single
 * outstanding code, and closes the "stack up valid codes" replay surface.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000
const MAX_CONSUME_ATTEMPTS = 5

export type IssuedEnrollmentChallenge = {
  code: string
  expiresAt: Date
}

export type ConsumeChallengeResult = { ok: true } | { ok: false; status: number; error: string }

const generateSixDigitCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0")

/**
 * Mints a fresh single-use OTP for `staffUserId`, invalidating any prior
 * still-active challenge for that same user first. The plaintext `code` is
 * returned ONLY so the caller can hand it to `sendSms` — it is never
 * persisted in plaintext and never returned from the HTTP endpoint.
 */
export const issueEnrollmentChallenge = async (staffUserId: string): Promise<IssuedEnrollmentChallenge> => {
  // Invalidate any prior active challenge for this user before minting a
  // new one — enforces the single-active-challenge invariant.
  await prisma.staffEnrollmentChallenge.updateMany({
    where: { staffUserId, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  const code = generateSixDigitCode()
  const codeHash = hashPin(code)
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)

  await prisma.staffEnrollmentChallenge.create({
    data: { staffUserId, codeHash, expiresAt },
  })

  return { code, expiresAt }
}

/**
 * Verifies `code` against the caller's own active challenge and consumes it
 * atomically on success. Scoped to `staffUserId` — a correct code bound to a
 * DIFFERENT user's challenge is never found here (cross-user rejection is a
 * natural consequence of the query scope, not a separate check).
 */
export const consumeEnrollmentChallenge = async (staffUserId: string, code: string): Promise<ConsumeChallengeResult> => {
  const challenge = await prisma.staffEnrollmentChallenge.findFirst({
    where: { staffUserId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  if (!challenge) {
    return { ok: false, status: 409, error: "No active enrollment code. Request a new one." }
  }

  if (challenge.attempts >= MAX_CONSUME_ATTEMPTS) {
    await prisma.staffEnrollmentChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })
    return { ok: false, status: 409, error: "Too many incorrect codes. Request a new one." }
  }

  if (!isValidPinHash(code, challenge.codeHash)) {
    await prisma.staffEnrollmentChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, status: 409, error: "Incorrect code." }
  }

  // Atomic one-time consume: the WHERE clause re-asserts `consumedAt: null`
  // so a concurrent second consume of the same challenge cannot both
  // succeed — whichever call's conditional update matches first "wins".
  const consumed = await prisma.staffEnrollmentChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  if (consumed.count === 0) {
    return { ok: false, status: 409, error: "This code was already used. Request a new one." }
  }

  return { ok: true }
}
