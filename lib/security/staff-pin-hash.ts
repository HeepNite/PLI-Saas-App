import { createHash, randomBytes, timingSafeEqual } from "crypto"

const PIN_HASH_ALGORITHM = "sha256"
const PIN_SALT_BYTES = 16

/**
 * Returns the effective secret used to derive and verify staff PIN hashes.
 *
 * Fail-closed: throws when the secret is not configured. There is no
 * hardcoded literal fallback (the previous per-site `|| "staff-pin"` was a
 * silent downgrade to a guessable shared key when the env var was unset).
 *
 * The effective secret remains `CLERK_SECRET_KEY` — a dedicated pepper is a
 * separate migration (see design ADR 5) — so every hash created before this
 * centralization still verifies through this module with no desync and no
 * staff lockout.
 */
export const getStaffPinSecret = (): string => {
  const secret = process.env.CLERK_SECRET_KEY
  if (!secret) {
    throw new Error("CLERK_SECRET_KEY is required to hash or verify staff PINs.")
  }
  return secret
}

/**
 * Hashes a 4-digit staff PIN into the `${salt}:${hash}` format persisted in
 * Clerk `privateMetadata.staffPinHash`. This is the ONLY create path — do
 * not duplicate this logic at call sites.
 */
export const hashPin = (pin: string): string => {
  const secret = getStaffPinSecret()
  const salt = randomBytes(PIN_SALT_BYTES).toString("hex")
  const hash = createHash(PIN_HASH_ALGORITHM).update(`${pin}:${salt}:${secret}`).digest("hex")
  return `${salt}:${hash}`
}

/**
 * Verifies a candidate PIN against a stored `${salt}:${hash}` value using a
 * constant-time comparison. This is the ONLY verify path — do not duplicate
 * this logic at call sites.
 */
export const isValidPinHash = (pin: string, pinHash: string): boolean => {
  const parts = pinHash.split(":")
  if (parts.length !== 2) return false
  const [salt, expectedHash] = parts
  if (!salt || !expectedHash) return false

  const secret = getStaffPinSecret()
  const nextHash = createHash(PIN_HASH_ALGORITHM).update(`${pin}:${salt}:${secret}`).digest("hex")

  try {
    const expectedBuffer = Buffer.from(expectedHash, "hex")
    const nextBuffer = Buffer.from(nextHash, "hex")
    if (expectedBuffer.length === 0 || nextBuffer.length === 0) return false
    if (expectedBuffer.length !== nextBuffer.length) return false
    return timingSafeEqual(expectedBuffer, nextBuffer)
  } catch {
    return false
  }
}

// Aliases matching the tasks.md naming (createStaffPinHash / verifyStaffPinHash).
// Kept as thin re-exports so all 6 call sites can adopt the shared module
// under their existing local names (hashPin / isValidPinHash) with a minimal
// diff, while the task/design artifacts' naming remains satisfied too.
export const createStaffPinHash = hashPin
export const verifyStaffPinHash = isValidPinHash
