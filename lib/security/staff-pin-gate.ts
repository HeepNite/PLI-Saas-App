import { auth, clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { resolveSchoolIdFromUser } from "@/lib/security/staff-school"
import { readTrustedDeviceCookie, validateTrustedDeviceToken } from "@/lib/security/staff-trusted-device"

/**
 * TOTAL gate context resolution for the staff PIN routes (login/pin,
 * checkin/pin) — design v5 PIN Data Flow.
 *
 * Resolution order: PERSONAL device cookie -> TERMINAL session -> CLERK_SESSION
 * (monitor mode only) -> ELSE reject. Every branch either yields a
 * server-derived `expectedSchoolId` or the request is rejected — no branch
 * ever reaches a hash compare with an undefined school scope.
 */

export type StaffPinGateMode = "monitor" | "enforce"

export const getStaffDeviceGateMode = (): StaffPinGateMode =>
  process.env.STAFF_DEVICE_GATE_MODE === "enforce" ? "enforce" : "monitor"

export type StaffPinRequestContext =
  | { kind: "PERSONAL"; ownerUserId: string; expectedSchoolId: string }
  | { kind: "TERMINAL"; terminalSlug: string; expectedSchoolId: string }
  | { kind: "CLERK_SESSION"; ownerUserId: string; expectedSchoolId: string }

export type StaffPinGateResult =
  | { ok: true; context: StaffPinRequestContext }
  | { ok: false; status: number; error: string }

type PersonalDeviceResolution = StaffPinRequestContext | { rejected: true; error: string } | null

/**
 * Resolves the PERSONAL-device context from the trusted-device cookie
 * (`lib/security/staff-trusted-device.ts`, wired in PR3 — replaces the PR2
 * structural stub that always returned null).
 *
 * A missing or invalid/revoked cookie falls through (returns null) so the
 * gate can try TERMINAL/CLERK_SESSION next. A VALID device whose owner has
 * no resolvable school context is explicitly REJECTED (never falls
 * through) — same fail-closed shape as the terminal/Clerk-session branches
 * (design v5 ADR 14: mandatory expectedSchoolId, no silent unscoped path).
 */
const resolvePersonalDeviceContext = async (): Promise<PersonalDeviceResolution> => {
  const token = await readTrustedDeviceCookie()
  if (!token) return null

  const device = await validateTrustedDeviceToken(token)
  if (!device) return null

  const client = await clerkClient()
  let user
  try {
    user = await client.users.getUser(device.staffUserId)
  } catch {
    return null
  }

  const expectedSchoolId = resolveSchoolIdFromUser(user)
  if (!expectedSchoolId) {
    return {
      rejected: true,
      error: "Your account is missing a school context. Contact an admin to configure it.",
    }
  }

  return { kind: "PERSONAL", ownerUserId: device.staffUserId, expectedSchoolId }
}

type TerminalResolution = StaffPinRequestContext | { rejected: true; error: string } | null

const resolveTerminalContext = async (): Promise<TerminalResolution> => {
  const session = await authorizeStaffTerminalSession()
  if (!session.ok) return null

  if (!session.terminal.schoolId) {
    return {
      rejected: true,
      error: "This terminal is missing a school context. Contact an admin to configure it.",
    }
  }

  return {
    kind: "TERMINAL",
    terminalSlug: session.terminal.slug,
    expectedSchoolId: session.terminal.schoolId,
  }
}

type ClerkSessionResolution = StaffPinRequestContext | { rejected: true; error: string } | null

const resolveClerkSessionContext = async (mode: StaffPinGateMode): Promise<ClerkSessionResolution> => {
  // CLERK_SESSION is a monitor-mode-exclusive would-block-but-continue
  // context (design v5 ADR 1). In enforce mode this branch never resolves,
  // so a Clerk-session-only request falls through to the generic 403 below.
  if (mode !== "monitor") return null

  const authResult = await auth()
  if (!authResult.userId) return null

  const client = await clerkClient()
  let user
  try {
    user = await client.users.getUser(authResult.userId)
  } catch {
    return null
  }

  const expectedSchoolId = resolveSchoolIdFromUser(user)
  if (!expectedSchoolId) {
    return {
      rejected: true,
      error: "Your account is missing a school context. Contact an admin to configure it.",
    }
  }

  return { kind: "CLERK_SESSION", ownerUserId: authResult.userId, expectedSchoolId }
}

export const resolveStaffPinGate = async (): Promise<StaffPinGateResult> => {
  const mode = getStaffDeviceGateMode()

  const personal = await resolvePersonalDeviceContext()
  if (personal) {
    if ("rejected" in personal) return { ok: false, status: 403, error: personal.error }
    return { ok: true, context: personal }
  }

  const terminal = await resolveTerminalContext()
  if (terminal) {
    if ("rejected" in terminal) return { ok: false, status: 403, error: terminal.error }
    return { ok: true, context: terminal }
  }

  const clerkSession = await resolveClerkSessionContext(mode)
  if (clerkSession) {
    if ("rejected" in clerkSession) return { ok: false, status: 403, error: clerkSession.error }
    return { ok: true, context: clerkSession }
  }

  // No server-derived scope possible — reject in EVERY mode. No scan, no mint.
  return { ok: false, status: 403, error: "No trusted device or session context found for this request." }
}
