import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  assertStudentPinConfirmation,
  clearStudentPinLockout,
  getStudentPinStatus,
  isStudentPinConflictError,
  isLockedCredential,
  isStudentPinLifecycleEnabled,
  replacePermanentStudentPin,
  verifyStudentPinHash,
} from "@/lib/security/student-pin"
import { STUDENT_PIN_AUDIT_ACTIONS, writeStudentPinAudit } from "@/lib/security/student-pin-audit"
import { upsertUserByIdentifiers } from "@/lib/users"

export const runtime = "nodejs"

const getAuthenticatedDbUser = async (authUserId: string) => {
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(authUserId)
  const dbUser = await upsertUserByIdentifiers({
    clerkId: authUserId,
    email: clerkUser.primaryEmailAddress?.emailAddress || undefined,
    phone: clerkUser.primaryPhoneNumber?.phoneNumber || undefined,
    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined,
    nameIsCanonical: true,
  })

  return { clerkUser, dbUser }
}

const unauthorizedResponse = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })

const unresolvedUserResponse = () =>
  NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })

const resolveAuthenticatedDbUser = async () => {
  const authResult = await auth()
  if (!authResult.userId) {
    return { response: unauthorizedResponse() }
  }

  const { dbUser } = await getAuthenticatedDbUser(authResult.userId)
  if (!dbUser) {
    return { response: unresolvedUserResponse() }
  }

  return { authUserId: authResult.userId, dbUser }
}

export async function GET(req: Request) {
  if (!isStudentPinLifecycleEnabled()) {
    return NextResponse.json({ error: "Student PIN lifecycle is disabled." }, { status: 404 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("profile:pin:get", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const userResolution = await resolveAuthenticatedDbUser()
  if ("response" in userResolution) {
    return userResolution.response
  }

  const status = await getStudentPinStatus(userResolution.dbUser.id)
  return NextResponse.json(status)
}

export async function PUT(req: Request) {
  if (!isStudentPinLifecycleEnabled()) {
    return NextResponse.json({ error: "Student PIN lifecycle is disabled." }, { status: 404 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("profile:pin:put", getClientIp(req)),
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

  const payload = body as Record<string, unknown>
  const currentPin = typeof payload.currentPin === "string" ? payload.currentPin.trim() : ""
  const nextPin = typeof payload.nextPin === "string" ? payload.nextPin.trim() : ""
  const confirmPin = typeof payload.confirmPin === "string" ? payload.confirmPin.trim() : ""

  const confirmationError = assertStudentPinConfirmation(nextPin, confirmPin)
  if (confirmationError) {
    return NextResponse.json({ error: confirmationError.error }, { status: confirmationError.status })
  }

  const userResolution = await resolveAuthenticatedDbUser()
  if ("response" in userResolution) {
    return userResolution.response
  }

  const existingPermanent = await prisma.studentPinCredential.findUnique({
    where: {
      userId_kind: {
        userId: userResolution.dbUser.id,
        kind: "permanent",
      },
    },
  })

  if (currentPin) {
    if (!existingPermanent) {
      return NextResponse.json({ error: "Current PIN is not available for this account." }, { status: 400 })
    }
    if (isLockedCredential(existingPermanent)) {
      return NextResponse.json({ error: "PIN is locked. Use recovery to set a new PIN." }, { status: 423 })
    }
    const matches = await verifyStudentPinHash(currentPin, existingPermanent)
    if (!matches) {
      return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 401 })
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await replacePermanentStudentPin(tx as typeof prisma, { userId: userResolution.dbUser.id, nextPin })
      await clearStudentPinLockout(tx as typeof prisma, userResolution.dbUser.id)
    })
  } catch (error) {
    if (isStudentPinConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }

  await writeStudentPinAudit({
    userId: userResolution.dbUser.id,
    action: currentPin ? STUDENT_PIN_AUDIT_ACTIONS.RESET : STUDENT_PIN_AUDIT_ACTIONS.RECOVERY_RESET,
    result: "success",
    actorType: "student",
    actorClerkId: userResolution.authUserId,
    credentialKind: "permanent",
    metadata: { recoveredWithoutCurrentPin: !currentPin },
  })

  const status = await getStudentPinStatus(userResolution.dbUser.id)
  return NextResponse.json({ ok: true, status })
}
