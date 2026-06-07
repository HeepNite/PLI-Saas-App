import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createKioskIdentificationSession } from "@/lib/checkin/kiosk-session"
import { getKioskPinThrottleMessage, resolveKioskPinThrottleSeverity } from "@/lib/security/kiosk-pin-throttle"
import {
  createStudentPinLookupDigest,
  clearTerminalMisses,
  isStudentPinFormatValid,
  isStudentPinExpired,
  isStudentPinLifecycleEnabled,
  isStudentPinObsolete,
  isTerminalBlocked,
  lookupActiveCredentialByDigest,
  markStudentPinVerified,
  recordTerminalMiss,
  syncStudentPinLifecycleForCredential,
  verifyStudentPinHash,
} from "@/lib/security/student-pin"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { STUDENT_PIN_AUDIT_ACTIONS, writeStudentPinAudit } from "@/lib/security/student-pin-audit"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (!isStudentPinLifecycleEnabled()) {
    return NextResponse.json({ error: "Student PIN lifecycle is disabled." }, { status: 404 })
  }

  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return NextResponse.json({ error: "Terminal session required for kiosk PIN identification." }, { status: 401 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey(`checkin:pin:identify:${terminalAuth.sessionId}`, getClientIp(req)),
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
  const pin = typeof payload?.pin === "string" ? payload.pin.trim() : ""

  if (!isStudentPinFormatValid(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

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

  const now = new Date()
  const pinLookupDigest = createStudentPinLookupDigest(pin)
  const credential = await lookupActiveCredentialByDigest(prisma, pinLookupDigest)

  if (
    !credential ||
    !(await verifyStudentPinHash(pin, {
      pinHash: credential.pinHash,
      pinLookupDigest: credential.pinLookupDigest,
    }))
  ) {
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

  if (credential.kind === "provisional" && isStudentPinExpired(credential, now)) {
    await prisma.$transaction(async (tx) => {
      await syncStudentPinLifecycleForCredential(tx as typeof prisma, credential, {
        now,
        source: "kiosk_identify",
        terminalId: terminalAuth.terminal.id,
      })
    })

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

  if (credential.kind === "permanent" && isStudentPinObsolete(credential, now)) {
    const identification = await prisma.$transaction(async (tx) => {
      await syncStudentPinLifecycleForCredential(tx as typeof prisma, credential, {
        now,
        source: "kiosk_identify",
        terminalId: terminalAuth.terminal.id,
      })

      const session = await createKioskIdentificationSession(tx as typeof prisma, {
        terminalId: terminalAuth.terminal.id,
        userId: credential.userId,
        credentialKind: credential.kind,
        requiresPinRotation: true,
      })

      await clearTerminalMisses(tx as typeof prisma, terminalAuth.terminal.id)

      return session
    })

    return NextResponse.json({
      identified: true,
      userId: credential.userId,
      credentialKind: identification.credentialKind,
      requiresPinRotation: true,
      requiresPinRegeneration: true,
      regenerationReason: "obsolete",
      sessionToken: identification.id,
      sessionExpiresAt: identification.expiresAt.toISOString(),
    })
  }

  const identification = await prisma.$transaction(async (tx) => {
    const verified = await markStudentPinVerified(tx as typeof prisma, credential.id)
    const session = await createKioskIdentificationSession(tx as typeof prisma, {
      terminalId: terminalAuth.terminal.id,
      userId: credential.userId,
      credentialKind: credential.kind,
      requiresPinRotation: verified.kind === "provisional" || verified.status === "rotation_required",
    })
    await clearTerminalMisses(tx as typeof prisma, terminalAuth.terminal.id)
    await writeStudentPinAudit({
      db: tx as typeof prisma,
      userId: credential.userId,
      action: STUDENT_PIN_AUDIT_ACTIONS.KIOSK_IDENTIFIED,
      result: "success",
      actorType: "system",
      credentialKind: credential.kind,
      terminalId: terminalAuth.terminal.id,
      metadata: {
        requiresPinRotation: session.requiresPinRotation,
      },
    })
    return session
  })

  return NextResponse.json({
    identified: true,
    userId: credential.userId,
    credentialKind: identification.credentialKind,
    requiresPinRotation: identification.requiresPinRotation,
    sessionToken: identification.id,
    sessionExpiresAt: identification.expiresAt.toISOString(),
  })
}
