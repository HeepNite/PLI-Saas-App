import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * Screen token authorization (design.md D2). `RaffleEvent.screenTokenHash`
 * stores the SHA-256 hex digest of the raw token; verification hashes the
 * candidate token first so both buffers being compared are always exactly
 * 32 bytes, which removes `timingSafeEqual`'s length-mismatch throw as a
 * code path.
 */

// 36h — long enough to cover a full event night without re-exchanging.
export const SCREEN_COOKIE_MAX_AGE_SEC = 36 * 60 * 60

export { isRaffleSlug } from "@/lib/raffle/slug"

export const generateScreenToken = (): string => randomBytes(32).toString("base64url")

export const hashScreenToken = (raw: string): string => createHash("sha256").update(raw).digest("hex")

export const screenTokenMatches = (raw: string, storedHash: string): boolean => {
  const candidate = Buffer.from(hashScreenToken(raw), "hex")
  const stored = Buffer.from(storedHash, "hex")
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

export const screenCookieName = (slug: string): string => `pli_raffle_screen_${slug}`
