import { createHmac } from "crypto"
import argon2 from "argon2"
import { Prisma, type StudentPinCredential } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { STUDENT_PIN_AUDIT_ACTIONS, writeStudentPinAudit } from "@/lib/security/student-pin-audit"

export const STUDENT_PIN_KINDS = ["permanent", "provisional"] as const
export type StudentPinKind = (typeof STUDENT_PIN_KINDS)[number]

export const STUDENT_PIN_STATUS = [
  "active",
  "locked",
  "rotation_required",
  "obsolete",
  "expired",
  "consumed",
  "superseded",
] as const
export type StudentPinStatusValue = (typeof STUDENT_PIN_STATUS)[number]

export const STUDENT_PIN_MAX_FAILED_ATTEMPTS = 5
export const STUDENT_PIN_TERMINAL_MISS_WINDOW_MS = 10 * 60 * 1000
export const STUDENT_PIN_TERMINAL_BLOCK_MS = 5 * 60 * 1000
export const STUDENT_PIN_OBSOLETE_AFTER_MONTHS = 6

const STUDENT_PIN_ACTIVE_LOOKUP_STATUSES = ["active", "rotation_required"] as const

export class StudentPinConflictError extends Error {
  code = "PIN_ALREADY_IN_USE"

  constructor(message = "PIN already in use by another student. Please choose a different PIN.") {
    super(message)
    this.name = "StudentPinConflictError"
  }
}

type StudentPinDbClient = Prisma.TransactionClient | typeof prisma

export type StudentPinSummary = {
  enabled: boolean
  enrolled: boolean
  locked: boolean
  needsEnrollment: boolean
  requiresRegeneration: boolean
  permanent: {
    status: StudentPinStatusValue | null
    failedAttempts: number
    lockedAt: string | null
    lastVerifiedAt: string | null
    lastPinAuthAt: string | null
    requiresRegeneration: boolean
  }
  provisional: {
    active: boolean
    expiresAt: string | null
  }
}

export type StudentPinTerminalThrottleState = {
  blocked: boolean
  blockedUntil: Date | null
  attemptsRemaining: number
  missCount: number
}

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 64 * 1024,
  parallelism: 1,
} as const

const getPepper = () => {
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

const endOfUtcDay = (value = new Date()) => {
  const next = new Date(value)
  next.setUTCHours(23, 59, 59, 999)
  return next
}

const subtractMonths = (value: Date, months: number) => {
  const next = new Date(value)
  next.setMonth(next.getMonth() - months)
  return next
}

export const isStudentPinLifecycleEnabled = () =>
  process.env.STUDENT_PIN_LIFECYCLE_ENABLED === "true"

export const isStudentPinFormatValid = (value: string) => /^\d{4}$/.test(value)

export const assertStudentPinConfirmation = (nextPin: string, confirmPin: string) => {
  if (!isStudentPinFormatValid(nextPin)) {
    return { status: 400, error: "PIN must be exactly 4 digits." }
  }
  if (nextPin !== confirmPin) {
    return { status: 400, error: "PIN confirmation does not match." }
  }
  return null
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

export const isStudentPinConflictError = (error: unknown): error is StudentPinConflictError =>
  error instanceof StudentPinConflictError ||
  (Boolean(error && typeof error === "object" && "code" in error) &&
    (error as { code?: unknown }).code === "PIN_ALREADY_IN_USE")

export const isLockedCredential = (credential: { lockedAt: Date | null; failedAttempts: number }) =>
  Boolean(credential.lockedAt || credential.failedAttempts >= STUDENT_PIN_MAX_FAILED_ATTEMPTS)

export const isStudentPinObsolete = (
  credential: {
    kind: string
    status: string
    createdAt: Date
    lastPinAuthAt?: Date | null
  },
  now = new Date()
) => {
  if (credential.kind !== "permanent") return false
  if (!STUDENT_PIN_ACTIVE_LOOKUP_STATUSES.includes(credential.status as (typeof STUDENT_PIN_ACTIVE_LOOKUP_STATUSES)[number])) {
    return credential.status === "obsolete"
  }

  const referenceAt = credential.lastPinAuthAt || credential.createdAt
  return referenceAt <= subtractMonths(now, STUDENT_PIN_OBSOLETE_AFTER_MONTHS)
}

export const requiresStudentPinRegeneration = (
  credential: {
    kind: string
    status: string
    createdAt: Date
    lastPinAuthAt?: Date | null
  },
  now = new Date()
) => credential.kind === "permanent" && isStudentPinObsolete(credential, now)

export const isStudentPinExpired = (
  credential: {
    kind: string
    status: string
    expiresAt?: Date | null
  },
  now = new Date()
) => {
  if (credential.kind !== "provisional") return false
  if (credential.status === "expired") return true
  if (!["active", "locked"].includes(credential.status)) return false
  return Boolean(credential.expiresAt && credential.expiresAt <= now)
}

export const assertStudentPinGlobalUniqueness = async (
  tx: StudentPinDbClient,
  input: { nextPin: string; credentialId?: string }
) => {
  const pinLookupDigest = createStudentPinLookupDigest(input.nextPin)
  const existing = await tx.studentPinCredential.findFirst({
    where: {
      pinLookupDigest,
      status: {
        in: [...STUDENT_PIN_ACTIVE_LOOKUP_STATUSES],
      },
      ...(input.credentialId
        ? {
            NOT: { id: input.credentialId },
          }
        : {}),
    },
    select: { id: true },
  })

  if (existing) {
    throw new StudentPinConflictError()
  }
}

const findOwnedCredentialId = async (tx: StudentPinDbClient, userId: string, kind: StudentPinKind) => {
  const credential = await tx.studentPinCredential.findUnique({
    where: {
      userId_kind: {
        userId,
        kind,
      },
    },
    select: { id: true },
  })

  return credential?.id
}

const rethrowStudentPinConflict = (error: unknown): never => {
  if (isStudentPinConflictError(error)) {
    throw error
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new StudentPinConflictError()
  }

  throw error
}

export const lookupActiveCredentialByDigest = async (tx: StudentPinDbClient, pinLookupDigest: string) => {
  return tx.studentPinCredential.findFirst({
    where: {
      pinLookupDigest,
      kind: { in: ["permanent", "provisional"] },
      status: { in: [...STUDENT_PIN_ACTIVE_LOOKUP_STATUSES] },
    },
    include: {
      user: {
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          phone: true,
        },
      },
    },
  })
}

export const lookupActiveCredentialByPin = async (tx: StudentPinDbClient, pin: string) =>
  lookupActiveCredentialByDigest(tx, createStudentPinLookupDigest(pin))

export const markStudentPinObsolete = async (tx: StudentPinDbClient, credentialId: string) =>
  tx.studentPinCredential.update({
    where: { id: credentialId },
    data: {
      status: "obsolete",
      failedAttempts: 0,
      lockedAt: null,
      lockReason: null,
    },
  })

export const markStudentPinExpired = async (tx: StudentPinDbClient, credentialId: string) =>
  tx.studentPinCredential.update({
    where: { id: credentialId },
    data: {
      status: "expired",
      failedAttempts: 0,
      lockedAt: null,
      lockReason: null,
    },
  })

export const syncStudentPinLifecycleForCredential = async (
  tx: StudentPinDbClient,
  credential: Pick<
    StudentPinCredential,
    "id" | "userId" | "kind" | "status" | "createdAt" | "lastPinAuthAt" | "expiresAt"
  >,
  input?: {
    now?: Date
    source?: string
    terminalId?: string | null
  }
) => {
  const now = input?.now || new Date()
  const source = input?.source || "lifecycle_sync"

  if (isStudentPinExpired(credential, now) && credential.status !== "expired") {
    const updated = await markStudentPinExpired(tx, credential.id)
    await writeStudentPinAudit({
      db: tx,
      userId: credential.userId,
      action: STUDENT_PIN_AUDIT_ACTIONS.EXPIRED,
      result: "success",
      actorType: "system",
      credentialKind: credential.kind,
      terminalId: input?.terminalId || null,
      metadata: { source },
    })
    return updated
  }

  if (credential.kind === "permanent" && isStudentPinObsolete(credential, now) && credential.status !== "obsolete") {
    const updated = await markStudentPinObsolete(tx, credential.id)
    await writeStudentPinAudit({
      db: tx,
      userId: credential.userId,
      action: STUDENT_PIN_AUDIT_ACTIONS.OBSOLETE,
      result: "success",
      actorType: "system",
      credentialKind: credential.kind,
      terminalId: input?.terminalId || null,
      metadata: { source },
    })
    return updated
  }

  return credential
}

export const syncStudentPinLifecycleForUser = async (
  tx: StudentPinDbClient,
  userId: string,
  now = new Date(),
  source = "status_sync"
) => {
  const credentials = await tx.studentPinCredential.findMany({
    where: {
      userId,
      kind: { in: ["permanent", "provisional"] },
    },
    select: {
      id: true,
      userId: true,
      kind: true,
      status: true,
      createdAt: true,
      lastPinAuthAt: true,
      expiresAt: true,
    },
  })

  for (const credential of credentials) {
    await syncStudentPinLifecycleForCredential(tx, credential, { now, source })
  }
}

export const isTerminalBlocked = async (
  tx: StudentPinDbClient,
  terminalId: string,
  now = new Date()
): Promise<StudentPinTerminalThrottleState> => {
  const counter = await tx.kioskTerminalMissCounter.findUnique({
    where: { terminalId },
  })

  if (!counter) {
    return {
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: STUDENT_PIN_MAX_FAILED_ATTEMPTS,
      missCount: 0,
    }
  }

  const blocked = Boolean(counter.blockedUntil && counter.blockedUntil > now)
  const withinWindow = counter.windowStart > new Date(now.getTime() - STUDENT_PIN_TERMINAL_MISS_WINDOW_MS)
  const missCount = withinWindow ? counter.missCount : 0

  return {
    blocked,
    blockedUntil: blocked ? counter.blockedUntil : null,
    attemptsRemaining: blocked ? 0 : Math.max(0, STUDENT_PIN_MAX_FAILED_ATTEMPTS - missCount),
    missCount,
  }
}

export const clearTerminalMisses = async (tx: StudentPinDbClient, terminalId: string) => {
  await tx.kioskTerminalMissCounter.deleteMany({
    where: { terminalId },
  })
}

export const recordTerminalMiss = async (tx: StudentPinDbClient, terminalId: string, now = new Date()) => {
  const existing = await tx.kioskTerminalMissCounter.findUnique({
    where: { terminalId },
  })

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      blocked: true,
      blockedUntil: existing.blockedUntil,
      attemptsRemaining: 0,
      missCount: existing.missCount,
    }
  }

  const withinWindow = existing
    ? existing.windowStart > new Date(now.getTime() - STUDENT_PIN_TERMINAL_MISS_WINDOW_MS)
    : false
  const nextMissCount = existing && withinWindow ? existing.missCount + 1 : 1
  const blockedUntil =
    nextMissCount >= STUDENT_PIN_MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + STUDENT_PIN_TERMINAL_BLOCK_MS) : null

  const counter = existing
    ? await tx.kioskTerminalMissCounter.update({
        where: { terminalId },
        data: {
          missCount: nextMissCount,
          windowStart: withinWindow ? existing.windowStart : now,
          blockedUntil,
        },
      })
    : await tx.kioskTerminalMissCounter.create({
        data: {
          terminalId,
          missCount: nextMissCount,
          windowStart: now,
          blockedUntil,
        },
      })

  return {
    blocked: Boolean(counter.blockedUntil && counter.blockedUntil > now),
    blockedUntil: counter.blockedUntil,
    attemptsRemaining:
      counter.blockedUntil && counter.blockedUntil > now
        ? 0
        : Math.max(0, STUDENT_PIN_MAX_FAILED_ATTEMPTS - counter.missCount),
    missCount: counter.missCount,
  }
}

const buildCredentialState = (kind: StudentPinKind, pinHash: string, pinLookupDigest: string, now: Date) => ({
  kind,
  status: "active",
  pinHash,
  pinLookupDigest,
  failedAttempts: 0,
  lockedAt: null,
  lockReason: null,
  lastVerifiedAt: null,
  lastPinAuthAt: null,
  expiresAt: kind === "provisional" ? endOfUtcDay(now) : null,
  usedAt: null,
  consumedAt: null,
})

export const replacePermanentStudentPin = async (
  tx: StudentPinDbClient,
  input: { userId: string; nextPin: string }
): Promise<StudentPinCredential> => {
  const now = new Date()
  const existingCredentialId = await findOwnedCredentialId(tx, input.userId, "permanent")
  await assertStudentPinGlobalUniqueness(tx, { nextPin: input.nextPin, credentialId: existingCredentialId })
  const hashed = await hashStudentPin(input.nextPin)

  try {
    const credential = await tx.studentPinCredential.upsert({
      where: {
        userId_kind: {
          userId: input.userId,
          kind: "permanent",
        },
      },
      create: {
        userId: input.userId,
        ...buildCredentialState("permanent", hashed.pinHash, hashed.pinLookupDigest, now),
      },
      update: buildCredentialState("permanent", hashed.pinHash, hashed.pinLookupDigest, now),
    })

    await tx.studentPinCredential.updateMany({
      where: {
        userId: input.userId,
        kind: "provisional",
        status: { in: ["active", "rotation_required", "locked"] },
      },
      data: {
        status: "superseded",
        consumedAt: now,
        lockedAt: null,
        lockReason: null,
        failedAttempts: 0,
      },
    })

    return credential
  } catch (error) {
    rethrowStudentPinConflict(error)
    throw error
  }
}

export const issueProvisionalStudentPin = async (
  tx: StudentPinDbClient,
  input: { userId: string; nextPin: string }
): Promise<StudentPinCredential> => {
  const now = new Date()
  const existingCredentialId = await findOwnedCredentialId(tx, input.userId, "provisional")
  await assertStudentPinGlobalUniqueness(tx, { nextPin: input.nextPin, credentialId: existingCredentialId })
  const hashed = await hashStudentPin(input.nextPin)
  try {
    return await tx.studentPinCredential.upsert({
      where: {
        userId_kind: {
          userId: input.userId,
          kind: "provisional",
        },
      },
      create: {
        userId: input.userId,
        ...buildCredentialState("provisional", hashed.pinHash, hashed.pinLookupDigest, now),
      },
      update: buildCredentialState("provisional", hashed.pinHash, hashed.pinLookupDigest, now),
    })
  } catch (error) {
    rethrowStudentPinConflict(error)
    throw error
  }
}

export const clearStudentPinLockout = async (tx: StudentPinDbClient, userId: string) => {
  await tx.studentPinCredential.updateMany({
    where: {
      userId,
      kind: { in: ["permanent", "provisional"] },
    },
    data: {
      failedAttempts: 0,
      lockedAt: null,
      lockReason: null,
    },
  })
}

export const unlockStudentPinCredentials = async (tx: StudentPinDbClient, userId: string) => {
  const result = await tx.studentPinCredential.updateMany({
    where: {
      userId,
      kind: { in: ["permanent", "provisional"] },
      status: "locked",
    },
    data: {
      status: "active",
      failedAttempts: 0,
      lockedAt: null,
      lockReason: null,
    },
  })

  return result.count
}

export const recordFailedStudentPinAttempt = async (
  tx: StudentPinDbClient,
  input: { credentialId: string; failedAttempts: number; lockReason?: string | null }
) => {
  const failedAttempts = Math.max(0, input.failedAttempts + 1)
  const locked = failedAttempts >= STUDENT_PIN_MAX_FAILED_ATTEMPTS
  return tx.studentPinCredential.update({
    where: { id: input.credentialId },
    data: {
      failedAttempts,
      lockedAt: locked ? new Date() : null,
      lockReason: locked ? input.lockReason || "too_many_attempts" : null,
      status: locked ? "locked" : "active",
    },
  })
}

export const markStudentPinVerified = async (tx: StudentPinDbClient, credentialId: string) => {
  const existing = await tx.studentPinCredential.findUnique({
    where: { id: credentialId },
    select: { kind: true },
  })

  if (!existing) {
    throw new Error(`Student PIN credential not found: ${credentialId}`)
  }

  const now = new Date()

  return tx.studentPinCredential.update({
    where: { id: credentialId },
    data: {
      failedAttempts: 0,
      lockedAt: null,
      lockReason: null,
      status: existing.kind === "provisional" ? "rotation_required" : "active",
      lastVerifiedAt: now,
      lastPinAuthAt: now,
      usedAt: now,
    },
  })
}

export const consumeStudentPinCredential = async (
  tx: StudentPinDbClient,
  credentialId: string,
  consumedStatus: Extract<StudentPinStatusValue, "consumed" | "superseded"> = "consumed"
) => {
  const now = new Date()

  return tx.studentPinCredential.update({
    where: { id: credentialId },
    data: {
      status: consumedStatus,
      consumedAt: now,
      lockedAt: null,
      lockReason: null,
      failedAttempts: 0,
    },
  })
}

export const getStudentPinStatus = async (userId: string): Promise<StudentPinSummary> => {
  if (!isStudentPinLifecycleEnabled()) {
    return {
      enabled: false,
      enrolled: false,
      locked: false,
      needsEnrollment: false,
      requiresRegeneration: false,
      permanent: {
        status: null,
        failedAttempts: 0,
        lockedAt: null,
        lastVerifiedAt: null,
        lastPinAuthAt: null,
        requiresRegeneration: false,
      },
      provisional: { active: false, expiresAt: null },
    }
  }

  const credentials = await prisma.$transaction(async (tx) => {
    await syncStudentPinLifecycleForUser(tx as typeof prisma, userId)
    return tx.studentPinCredential.findMany({
      where: { userId, kind: { in: ["permanent", "provisional"] } },
    })
  })
  const permanent = credentials.find((item) => item.kind === "permanent") || null
  const provisional = credentials.find((item) => item.kind === "provisional") || null
  const requiresRegeneration = Boolean(permanent && requiresStudentPinRegeneration(permanent))
  const enrolled = Boolean(permanent && !["expired", "obsolete"].includes(permanent.status))
  const locked = Boolean(permanent && isLockedCredential(permanent))
  const provisionalActive = Boolean(
    provisional &&
      provisional.status !== "expired" &&
      provisional.status !== "obsolete" &&
      provisional.status !== "superseded" &&
      provisional.status !== "consumed" &&
      (!provisional.expiresAt || provisional.expiresAt > new Date())
  )

  return {
    enabled: true,
    enrolled,
    locked,
    needsEnrollment: !enrolled,
    requiresRegeneration,
    permanent: {
      status: (permanent?.status as StudentPinStatusValue | null) || null,
      failedAttempts: permanent?.failedAttempts || 0,
      lockedAt: permanent?.lockedAt?.toISOString() || null,
      lastVerifiedAt: permanent?.lastVerifiedAt?.toISOString() || null,
      lastPinAuthAt: permanent?.lastPinAuthAt?.toISOString() || null,
      requiresRegeneration,
    },
    provisional: {
      active: provisionalActive,
      expiresAt: provisional?.expiresAt?.toISOString() || null,
    },
  }
}
