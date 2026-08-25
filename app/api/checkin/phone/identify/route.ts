import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createKioskIdentificationSession } from "@/lib/checkin/kiosk-session"
import { getKioskPinThrottleMessage, resolveKioskPinThrottleSeverity } from "@/lib/security/kiosk-pin-throttle"
import {
  clearTerminalMisses,
  isTerminalBlocked,
  recordTerminalMiss,
} from "@/lib/security/student-pin"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { normalizePhone } from "@/lib/shared"

export const runtime = "nodejs"

const MIN_PHONE_DIGITS = 10

export async function POST(req: Request) {
  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return NextResponse.json({ error: "Terminal session required for kiosk identification." }, { status: 401 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey(`checkin:phone:identify:${terminalAuth.sessionId}`, getClientIp(req)),
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

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  const rawPhone = typeof payload?.phone === "string" ? payload.phone.trim() : ""
  const phone = normalizePhone(rawPhone)

  if (!phone || phone.length < MIN_PHONE_DIGITS) {
    return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 })
  }

  // Check terminal throttle (reuse PIN throttle infrastructure)
  const terminalState = await isTerminalBlocked(prisma, terminalAuth.terminal.id)
  if (terminalState.blocked) {
    const severity = resolveKioskPinThrottleSeverity({
      missCount: terminalState.missCount,
      blockedUntil: terminalState.blockedUntil,
    })
    return NextResponse.json(
      {
        identified: false,
        terminalBlocked: terminalState.terminalBlocked,
        blockedUntil: terminalState.blockedUntil?.toISOString() || null,
        attemptsRemaining: terminalState.attemptsRemaining,
        severity,
        message: getKioskPinThrottleMessage(severity),
      },
      { status: terminalState.terminalBlocked ? 429 : 423 }
    )
  }

  // Try exact match first, then with US country code prefix
  const phoneCandidates = phone.startsWith("1") ? [phone, phone.slice(1)] : [phone, `1${phone}`]
  const user = await prisma.user.findFirst({
    where: { phone: { in: phoneCandidates } },
    select: { id: true },
  })

  if (!user) {
    const now = new Date()
    const miss = await recordTerminalMiss(prisma, terminalAuth.terminal.id, now)
    const severity = resolveKioskPinThrottleSeverity({ missCount: miss.missCount, blockedUntil: miss.blockedUntil, now })
    return NextResponse.json(
      {
        identified: false,
        terminalBlocked: miss.terminalBlocked,
        blockedUntil: miss.blockedUntil?.toISOString() || null,
        attemptsRemaining: miss.attemptsRemaining,
        severity,
        message: getKioskPinThrottleMessage(severity),
      },
      { status: miss.terminalBlocked ? 429 : miss.cooldownActive ? 423 : 401 }
    )
  }

  const session = await prisma.$transaction(async (tx) => {
    const kioskSession = await createKioskIdentificationSession(tx as typeof prisma, {
      terminalId: terminalAuth.terminal.id,
      userId: user.id,
      credentialKind: "phone",
      requiresPinRotation: false,
    })
    await clearTerminalMisses(tx as typeof prisma, terminalAuth.terminal.id)
    return kioskSession
  })

  return NextResponse.json({
    identified: true,
    userId: user.id,
    credentialKind: "phone",
    requiresPinRotation: false,
    sessionToken: session.id,
    sessionExpiresAt: session.expiresAt.toISOString(),
  })
}
