import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { hasExplicitStaffPermission } from "@/lib/security/staff-access"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import {
  StudentPinConflictError,
  clearStudentPinLockout,
  getStudentPinStatus,
  isStudentPinConflictError,
  isStudentPinFormatValid,
  isStudentPinLifecycleEnabled,
  issueProvisionalStudentPin,
  replacePermanentStudentPin,
  unlockStudentPinCredentials,
} from "@/lib/security/student-pin"
import { STUDENT_PIN_AUDIT_ACTIONS, writeStudentPinAudit } from "@/lib/security/student-pin-audit"

export const runtime = "nodejs"

const generateProvisionalPin = () => String(randomInt(0, 10_000)).padStart(4, "0")
const AUTO_GENERATED_PIN_RETRY_LIMIT = 25

const maskPin = (pin: string) => `${"*".repeat(Math.max(0, pin.length - 2))}${pin.slice(-2)}`

const issueProvisionalPin = async (tx: typeof prisma, userId: string, providedPin?: string) => {
  if (providedPin) {
    const credential = await issueProvisionalStudentPin(tx, { userId, nextPin: providedPin })
    return { credential, provisionalPin: providedPin }
  }

  for (let attempt = 0; attempt < AUTO_GENERATED_PIN_RETRY_LIMIT; attempt += 1) {
    const provisionalPin = generateProvisionalPin()

    try {
      const credential = await issueProvisionalStudentPin(tx, { userId, nextPin: provisionalPin })
      return { credential, provisionalPin }
    } catch (error) {
      if (!isStudentPinConflictError(error)) {
        throw error
      }
    }
  }

  throw new StudentPinConflictError("Unable to generate a unique provisional PIN right now. Please try again.")
}

const STAFF_PIN_ACTIONS = {
  ISSUE_PROVISIONAL: STUDENT_PIN_AUDIT_ACTIONS.ISSUE_PROVISIONAL,
  RESET_PERMANENT: "reset_permanent",
  UNLOCK: "unlock",
} as const

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  if (!isStudentPinLifecycleEnabled()) {
    return NextResponse.json({ error: "Student PIN lifecycle is disabled." }, { status: 404 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:pin:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  if (!authResult.role) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const action = typeof payload.action === "string" ? payload.action.trim() : ""
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  const providedPin = typeof payload.provisionalPin === "string" ? payload.provisionalPin.trim() : ""
  const nextPin = typeof payload.nextPin === "string" ? payload.nextPin.trim() : ""

  if (!Object.values(STAFF_PIN_ACTIONS).includes(action as (typeof STAFF_PIN_ACTIONS)[keyof typeof STAFF_PIN_ACTIONS])) {
    return NextResponse.json({ error: "Unsupported PIN action." }, { status: 400 })
  }
  if (reason.length < 8) {
    return NextResponse.json({ error: "Add a short reason so the audit log explains the PIN action." }, { status: 400 })
  }
  if (action === STAFF_PIN_ACTIONS.ISSUE_PROVISIONAL && providedPin && !isStudentPinFormatValid(providedPin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }
  if (action === STAFF_PIN_ACTIONS.RESET_PERMANENT && !isStudentPinFormatValid(nextPin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      studentPinCredentials: {
        where: { kind: { in: ["permanent", "provisional"] } },
        select: {
          kind: true,
          status: true,
          expiresAt: true,
        },
      },
    },
  })

  if (!targetUser) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 })
  }

  if (!hasExplicitStaffPermission(authResult.role, authResult.category, "studentPinOps")) {
    await writeStudentPinAudit({
      userId: targetUser.id,
      action: STUDENT_PIN_AUDIT_ACTIONS.STAFF_DENIED,
      result: "denied",
      actorType: "staff",
      actorClerkId: authResult.userId,
      actorRole: authResult.role,
      reason,
      metadata: {
        attemptedAction: action,
      },
    })
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const currentPermanent = targetUser.studentPinCredentials.find((credential) => credential.kind === "permanent") || null
  const currentProvisional = targetUser.studentPinCredentials.find((credential) => credential.kind === "provisional") || null

  let status
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (action === STAFF_PIN_ACTIONS.ISSUE_PROVISIONAL) {
        const issued = await issueProvisionalPin(tx as typeof prisma, targetUser.id, providedPin || undefined)
        await clearStudentPinLockout(tx as typeof prisma, targetUser.id)
        await writeStudentPinAudit({
          db: tx as typeof prisma,
          userId: targetUser.id,
          action: STUDENT_PIN_AUDIT_ACTIONS.ISSUE_PROVISIONAL,
          result: "success",
          actorType: "staff",
          actorClerkId: authResult.userId,
          actorRole: authResult.role,
          credentialKind: "provisional",
          reason,
          metadata: {
            hadPermanentPin: Boolean(currentPermanent),
            previousProvisionalStatus: currentProvisional?.status || null,
            previousProvisionalExpiresAt: currentProvisional?.expiresAt?.toISOString() || null,
          },
        })
        return {
          provisionalPin: issued.provisionalPin,
          credential: issued.credential,
        }
      }

      if (action === STAFF_PIN_ACTIONS.RESET_PERMANENT) {
        const credential = await replacePermanentStudentPin(tx as typeof prisma, { userId: targetUser.id, nextPin })
        await clearStudentPinLockout(tx as typeof prisma, targetUser.id)
        await writeStudentPinAudit({
          db: tx as typeof prisma,
          userId: targetUser.id,
          action: STUDENT_PIN_AUDIT_ACTIONS.RESET,
          result: "success",
          actorType: "staff",
          actorClerkId: authResult.userId,
          actorRole: authResult.role,
          credentialKind: "permanent",
          reason,
          metadata: {
            hadPermanentPin: Boolean(currentPermanent),
            previousPermanentStatus: currentPermanent?.status || null,
            previousProvisionalStatus: currentProvisional?.status || null,
            previousProvisionalExpiresAt: currentProvisional?.expiresAt?.toISOString() || null,
          },
        })
        return {
          nextPin,
          credential,
        }
      }

      const unlockedCredentialCount = await unlockStudentPinCredentials(tx as typeof prisma, targetUser.id)
      await writeStudentPinAudit({
        db: tx as typeof prisma,
        userId: targetUser.id,
        action: STUDENT_PIN_AUDIT_ACTIONS.UNLOCKED,
        result: "success",
        actorType: "staff",
        actorClerkId: authResult.userId,
        actorRole: authResult.role,
        reason,
        metadata: {
          previousPermanentStatus: currentPermanent?.status || null,
          previousProvisionalStatus: currentProvisional?.status || null,
          unlockedCredentialCount,
        },
      })
      return {
        unlockedCredentialCount,
      }
    })
    status = await getStudentPinStatus(targetUser.id)

    if (action === STAFF_PIN_ACTIONS.ISSUE_PROVISIONAL) {
      const issuedResult = result as {
        provisionalPin: string
        credential: { expiresAt: Date | null }
      }

      return NextResponse.json({
        ok: true,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
        },
        provisionalPin: issuedResult.provisionalPin,
        provisionalPinMasked: maskPin(issuedResult.provisionalPin),
        expiresAt: issuedResult.credential.expiresAt?.toISOString() || null,
        status,
      })
    }

    if (action === STAFF_PIN_ACTIONS.RESET_PERMANENT) {
      const resetResult = result as { nextPin: string }

      return NextResponse.json({
        ok: true,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
        },
        permanentPin: resetResult.nextPin,
        permanentPinMasked: maskPin(resetResult.nextPin),
        status,
      })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
      unlockedCredentialCount: result.unlockedCredentialCount,
      status,
    })
  } catch (error) {
    if (isStudentPinConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}
