import { NextResponse } from "next/server"
import { enforceNewStudentRules, hasVerifiedPhone } from "@/lib/checkout"
import { createKioskIdentificationSession } from "@/lib/checkin/kiosk-session"
import { findClerkUserByIdentifiers } from "@/lib/clerk-users"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { clearTerminalMisses, isTerminalBlocked, recordTerminalMiss } from "@/lib/security/student-pin"
import { normalizePhone } from "@/lib/shared"

export const runtime = "nodejs"

const MIN_PHONE_DIGITS = 10
const NEW_STUDENT_CREDENTIAL_KIND = "new_student_sms"
const NOT_VERIFIED_ERROR = "Phone verification required before card payment."

/** US numbers may be stored with or without the leading country code. */
const toPhoneKey = (value?: string | null) => {
  const digits = normalizePhone(value) || ""
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
}

/**
 * Mints a terminal-bound kiosk session for a new student whose phone was just
 * verified by SMS. The server re-reads Clerk: the client SMS state is never proof.
 */
export async function POST(req: Request) {
  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return NextResponse.json({ error: "Terminal session required for kiosk identification." }, { status: 401 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey(`checkin:qr:new-student:kiosk-session:${terminalAuth.sessionId}`, getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const rawPhone = body && typeof body === "object" && typeof (body as { phone?: unknown }).phone === "string"
    ? ((body as { phone: string }).phone).trim()
    : ""
  const phoneKey = toPhoneKey(rawPhone)
  if (phoneKey.length < MIN_PHONE_DIGITS) {
    return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 })
  }

  const terminalState = await isTerminalBlocked(prisma, terminalAuth.terminal.id)
  if (terminalState.blocked) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: terminalState.terminalBlocked ? 429 : 423 }
    )
  }

  const refuse = async () => {
    await recordTerminalMiss(prisma, terminalAuth.terminal.id, new Date())
    return NextResponse.json({ error: NOT_VERIFIED_ERROR }, { status: 403 })
  }

  const clerkUser = await findClerkUserByIdentifiers({ phone: rawPhone })
  const clerkPhone = clerkUser?.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId) || clerkUser?.phoneNumbers[0]
  if (!clerkUser || !hasVerifiedPhone(clerkUser) || toPhoneKey(clerkPhone?.phoneNumber) !== phoneKey) {
    return refuse()
  }

  const dbUser = await prisma.user.findFirst({
    where: { clerkId: clerkUser.id },
    select: { id: true, phone: true },
  })
  if (!dbUser || toPhoneKey(dbUser.phone) !== phoneKey) {
    return refuse()
  }

  const eligibilityError = await enforceNewStudentRules({
    serviceId: "new-student",
    safeParticipants: 1,
    hasVerifiedPhone: true,
    resolvedUserId: clerkUser.id,
    resolvedEmail: clerkUser.primaryEmailAddress?.emailAddress || "",
    phoneNormalized: normalizePhone(rawPhone) || "",
  })
  if (eligibilityError) {
    return NextResponse.json(
      { error: eligibilityError.error, ...("code" in eligibilityError ? { code: eligibilityError.code } : {}) },
      { status: eligibilityError.status }
    )
  }

  const session = await prisma.$transaction(async (tx) => {
    const kioskSession = await createKioskIdentificationSession(tx as typeof prisma, {
      terminalId: terminalAuth.terminal.id,
      userId: dbUser.id,
      credentialKind: NEW_STUDENT_CREDENTIAL_KIND,
      requiresPinRotation: false,
    })
    await clearTerminalMisses(tx as typeof prisma, terminalAuth.terminal.id)
    return kioskSession
  })

  return NextResponse.json({
    sessionToken: session.id,
    sessionExpiresAt: session.expiresAt.toISOString(),
  })
}
