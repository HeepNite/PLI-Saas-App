import { auth, clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { resolveSchoolIdFromUser } from "@/lib/security/staff-school"

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

/**
 * PERSONAL-device enrollment (issuing/validating the trusted-device cookie)
 * is Phase 3 work (`lib/security/staff-trusted-device.ts`, tasks.md 3.6).
 * There are no enrolled devices yet in this phase, so this branch is
 * structurally reachable — it participates in the precedence order below —
 * but always yields no context until Phase 3 lands the cookie + DB lookup.
 */
const resolvePersonalDeviceContext = async (): Promise<StaffPinRequestContext | null> => null

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
  if (personal) return { ok: true, context: personal }

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
