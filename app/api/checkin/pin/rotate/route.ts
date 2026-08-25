import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import {
  assertStudentPinConfirmation,
  clearStudentPinLockout,
  consumeStudentPinCredential,
  isStudentPinConflictError,
  isStudentPinLifecycleEnabled,
  replacePermanentStudentPin,
} from "@/lib/security/student-pin"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { STUDENT_PIN_AUDIT_ACTIONS, writeStudentPinAudit } from "@/lib/security/student-pin-audit"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (!isStudentPinLifecycleEnabled()) {
    return NextResponse.json({ error: "Student PIN lifecycle is disabled." }, { status: 404 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkin:pin:rotate", getClientIp(req)),
    limit: 20,
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
  const sessionToken = typeof payload?.sessionToken === "string" ? payload.sessionToken.trim() : ""
  const nextPin = typeof payload?.nextPin === "string" ? payload.nextPin.trim() : ""
  const confirmPin = typeof payload?.confirmPin === "string" ? payload.confirmPin.trim() : ""

  const confirmationError = assertStudentPinConfirmation(nextPin, confirmPin)
  if (confirmationError) {
    return NextResponse.json({ error: confirmationError.error }, { status: confirmationError.status })
  }

  const kioskSessionResult = await resolveTerminalKioskSession(sessionToken, { allowRotationRequired: true })
  if (!kioskSessionResult.ok) {
    return NextResponse.json(
      { error: kioskSessionResult.error, ...(kioskSessionResult.code ? { code: kioskSessionResult.code } : {}) },
      { status: kioskSessionResult.status }
    )
  }

  if (!kioskSessionResult.session.requiresPinRotation && !kioskSessionResult.session.rotationBypassed) {
    return NextResponse.json({ error: "PIN rotation is not required for this kiosk session." }, { status: 409 })
  }

  const [provisionalCredential, permanentCredential] = await Promise.all([
    prisma.studentPinCredential.findUnique({
      where: {
        userId_kind: {
          userId: kioskSessionResult.session.userId,
          kind: "provisional",
        },
      },
      select: {
        id: true,
        status: true,
      },
    }),
    prisma.studentPinCredential.findUnique({
      where: {
        userId_kind: {
          userId: kioskSessionResult.session.userId,
          kind: "permanent",
        },
      },
      select: {
        id: true,
        status: true,
      },
    }),
  ])

  const hasActiveProvisional = Boolean(
    provisionalCredential && ["active", "rotation_required"].includes(provisionalCredential.status)
  )
  const hasObsoletePermanent = Boolean(permanentCredential?.status === "obsolete")

  if (!hasActiveProvisional && !hasObsoletePermanent) {
    return NextResponse.json(
      { error: "Active provisional or obsolete permanent PIN not found for this session." },
      { status: 409 }
    )
  }

  const rotationSource = hasActiveProvisional ? "kiosk_rotation" : "kiosk_regeneration"

  try {
    const credential = await prisma.$transaction(async (tx) => {
      const nextCredential = await replacePermanentStudentPin(tx as typeof prisma, {
        userId: kioskSessionResult.session.userId,
        nextPin,
      })
      await clearStudentPinLockout(tx as typeof prisma, kioskSessionResult.session.userId)
      if (hasActiveProvisional && provisionalCredential) {
        await consumeStudentPinCredential(tx as typeof prisma, provisionalCredential.id, "consumed")
      }
      await tx.kioskIdentificationSession.update({
        where: { id: kioskSessionResult.session.id },
        data: {
          credentialKind: "permanent",
          requiresPinRotation: false,
          rotationBypassed: false,
        },
      })
      await writeStudentPinAudit({
        db: tx as typeof prisma,
        userId: kioskSessionResult.session.userId,
        action: STUDENT_PIN_AUDIT_ACTIONS.ROTATED,
        result: "success",
        actorType: "student",
        credentialKind: "permanent",
        terminalId: kioskSessionResult.terminalAuth.terminal.id,
        metadata: { source: rotationSource },
      })
      return nextCredential
    })

    return NextResponse.json({
      rotated: true,
      credential: {
        id: credential.id,
        kind: credential.kind,
        status: credential.status,
      },
    })
  } catch (error) {
    if (isStudentPinConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}
