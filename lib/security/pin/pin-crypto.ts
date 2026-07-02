import { createHmac } from "crypto"
import argon2 from "argon2"

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 64 * 1024,
  parallelism: 1,
} as const

export const getPepper = () => {
  const pepper =
    process.env.STUDENT_PIN_PEPPER ||
    process.env.CLERK_SECRET_KEY ||
    process.env.STAFF_TERMINAL_SECRET

  if (pepper) return pepper
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing STUDENT_PIN_PEPPER (or CLERK_SECRET_KEY/STAFF_TERMINAL_SECRET) for student PIN security.")
  }
  return "dev-student-pin-pepper-local-only"
}

export const createStudentPinLookupDigest = (pin: string) =>
  createHmac("sha256", getPepper())
    .update(pin)
    .digest("hex")

export const hashStudentPin = async (pin: string) => ({
  pinHash: await argon2.hash(pin, {
    ...ARGON_OPTIONS,
    secret: Buffer.from(getPepper(), "utf8"),
  }),
  pinLookupDigest: createStudentPinLookupDigest(pin),
})

export const verifyStudentPinHash = async (pin: string, input: { pinHash: string; pinLookupDigest: string }) => {
  if (createStudentPinLookupDigest(pin) !== input.pinLookupDigest) return false
  return argon2.verify(input.pinHash, pin, { secret: Buffer.from(getPepper(), "utf8") })
}
