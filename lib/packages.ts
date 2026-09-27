import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

type PackageMetadataInput = {
  courseSlug?: string
  packageId?: string
  packageLabel?: string
  packageTotalCredits?: string
  packageIsUnlimited?: string
  packageCadence?: string
  packageMakeUps?: string
  packageValidDays?: string
}

const toIntOrNull = (value?: string) => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const toPositiveIntOrDefault = (value: string | undefined, fallback: number) => {
  const parsed = toIntOrNull(value)
  if (!parsed || parsed <= 0) return fallback
  return parsed
}

const parseBoolean = (value?: string) => value === "true" || value === "1"

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

type PrismaTx = Prisma.TransactionClient | typeof prisma

export const buildPackagePurchasePayload = (metadata: PackageMetadataInput, purchasedAt = new Date()) => {
  const packageId = metadata.packageId?.trim()
  if (!packageId) return null

  const packageLabel = metadata.packageLabel?.trim() || packageId
  const validDays = toPositiveIntOrDefault(metadata.packageValidDays, 180)
  const totalCreditsRaw = toIntOrNull(metadata.packageTotalCredits)
  const makeUps = toPositiveIntOrDefault(metadata.packageMakeUps, 0)
  const isUnlimited = parseBoolean(metadata.packageIsUnlimited) || !totalCreditsRaw || totalCreditsRaw <= 0
  const totalCredits = isUnlimited ? null : totalCreditsRaw

  return {
    packageId,
    packageLabel,
    packageCadence: metadata.packageCadence?.trim() || null,
    makeUps,
    validDays,
    isUnlimited,
    totalCredits,
    remainingCredits: isUnlimited ? null : totalCredits,
    expiresAt: addDays(purchasedAt, validDays),
    courseSlug: metadata.courseSlug?.trim() || null,
  }
}

export const syncPackagePurchaseFromPaidPurchase = async (input: {
  userId: string
  purchaseId: string
  purchasedAt?: Date
  source?: string
  tx?: PrismaTx
  packagePlanId?: string
  metadata: PackageMetadataInput
}) => {
  const db = input.tx || prisma
  const packagePayload = buildPackagePurchasePayload(input.metadata, input.purchasedAt)
  if (!packagePayload) return null

  const existing = await db.packagePurchase.findUnique({
    where: { purchaseId: input.purchaseId },
  })
  if (existing) return existing

  const plan = input.packagePlanId
    ? await db.packagePlan.findUniqueOrThrow({ where: { id: input.packagePlanId } })
    : await db.packagePlan.upsert({
        where: { key: packagePayload.packageId },
        update: {
          label: packagePayload.packageLabel,
          cadence: packagePayload.packageCadence,
          totalCredits: packagePayload.totalCredits,
          makeUps: packagePayload.makeUps,
          validDays: packagePayload.validDays,
          isUnlimited: packagePayload.isUnlimited,
          active: true,
          ...(packagePayload.courseSlug ? { courseSlug: packagePayload.courseSlug } : {}),
        },
        create: {
          key: packagePayload.packageId,
          label: packagePayload.packageLabel,
          cadence: packagePayload.packageCadence,
          totalCredits: packagePayload.totalCredits,
          makeUps: packagePayload.makeUps,
          validDays: packagePayload.validDays,
          isUnlimited: packagePayload.isUnlimited,
          active: true,
          ...(packagePayload.courseSlug ? { courseSlug: packagePayload.courseSlug } : {}),
        },
      })

  try {
    return await db.packagePurchase.create({
      data: {
        userId: input.userId,
        packagePlanId: plan.id,
        courseSlug: packagePayload.courseSlug,
        packageId: packagePayload.packageId,
        packageLabel: packagePayload.packageLabel,
        totalCredits: packagePayload.totalCredits,
        remainingCredits: packagePayload.remainingCredits,
        isUnlimited: packagePayload.isUnlimited,
        purchasedAt: input.purchasedAt || new Date(),
        expiresAt: packagePayload.expiresAt,
        status: "active",
        purchaseId: input.purchaseId,
        source: input.source || "stripe",
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    // P2002 aborts a PostgreSQL interactive transaction. Recover through the
    // root client rather than issuing any command on the failed transaction.
    const replayed = await prisma.packagePurchase.findUnique({ where: { purchaseId: input.purchaseId } })
    if (!replayed) throw error
    return replayed
  }
}

const INTERNAL_GENERAL_CREDIT_PACKAGE_ID = "pli-internal-general-class-credit-v1"

type InternalCreditRevocationResult = "revoked" | "already-revoked" | "not-materialized" | "manual-resolution"

type LinkedPackagePurchase = { purchaseId: string | null }

// A linked Purchase is the financial authority for a package credit. The
// guarded no-op update both verifies paid eligibility and serializes against a
// concurrent reversal tombstone for the surrounding transaction. Packages
// without a linked Purchase retain their existing non-Stripe behavior.
export const guardPackagePurchaseEligibleForCreditTx = async (
  tx: PrismaTx,
  packagePurchase: LinkedPackagePurchase,
) => {
  if (!packagePurchase.purchaseId) return true
  const guarded = await tx.purchase.updateMany({
    where: { id: packagePurchase.purchaseId, status: "paid" },
    data: { status: "paid" },
  })
  return guarded.count === 1
}

const isInternalOneCreditPackage = (packagePurchase: {
  purchaseId: string | null
  userId: string
  packageId: string
  isUnlimited: boolean
  totalCredits: number | null
}, input: { purchaseId: string; userId: string }) =>
  packagePurchase.purchaseId === input.purchaseId &&
  packagePurchase.userId === input.userId &&
  packagePurchase.packageId === INTERNAL_GENERAL_CREDIT_PACKAGE_ID &&
  packagePurchase.isUnlimited === false &&
  packagePurchase.totalCredits === 1

// This operates inside the caller's transaction. It preserves the financial and
// usage records: status is the only state changed after all unused-credit guards hold.
export const revokeUnusedInternalPackagePurchaseTx = async (
  tx: PrismaTx,
  input: { purchaseId: string; userId: string },
): Promise<InternalCreditRevocationResult> => {
  const packagePurchase = await tx.packagePurchase.findUnique({ where: { purchaseId: input.purchaseId } })
  if (!packagePurchase) return "not-materialized"
  if (!isInternalOneCreditPackage(packagePurchase, input)) return "manual-resolution"

  if (packagePurchase.status === "revoked") return "already-revoked"
  if (packagePurchase.status !== "active" || packagePurchase.remainingCredits !== 1) return "manual-resolution"

  const usage = await tx.packageUsageLedger.findFirst({ where: { packagePurchaseId: packagePurchase.id } })
  if (usage) return "manual-resolution"

  const revoked = await tx.packagePurchase.updateMany({
    where: {
      id: packagePurchase.id,
      purchaseId: input.purchaseId,
      userId: input.userId,
      packageId: INTERNAL_GENERAL_CREDIT_PACKAGE_ID,
      status: "active",
      isUnlimited: false,
      totalCredits: 1,
      remainingCredits: 1,
    },
    data: { status: "revoked" },
  })
  if (revoked.count === 1) return "revoked"

  const afterGuard = await tx.packagePurchase.findUnique({ where: { purchaseId: input.purchaseId } })
  return afterGuard && isInternalOneCreditPackage(afterGuard, input) && afterGuard.status === "revoked"
    ? "already-revoked"
    : "manual-resolution"
}

export const consumePackageCreditForAttendance = async (input: {
  userId: string
  attendanceId: string
  courseSlug?: string
  checkedInAt?: Date
}) => {
  const existingUsage = await prisma.packageUsageLedger.findUnique({
    where: { attendanceId: input.attendanceId },
  })
  if (existingUsage) {
    const linkedPackage = await prisma.packagePurchase.findUnique({
      where: { id: existingUsage.packagePurchaseId },
    })
    return {
      packagePurchase: linkedPackage,
      usage: existingUsage,
      consumed: existingUsage.delta < 0,
    }
  }

  const now = input.checkedInAt || new Date()
  const activePackages = await prisma.packagePurchase.findMany({
    where: {
      userId: input.userId,
      status: "active",
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ isUnlimited: true, remainingCredits: null }, { remainingCredits: { gt: 0 } }] },
      ],
    },
    orderBy: [{ expiresAt: "asc" }, { purchasedAt: "asc" }],
  })

  if (!activePackages.length) return { packagePurchase: null, usage: null, consumed: false }

  const ordered = [...activePackages].sort((a, b) => {
    const aPriority = a.courseSlug && input.courseSlug && a.courseSlug === input.courseSlug ? 0 : 1
    const bPriority = b.courseSlug && input.courseSlug && b.courseSlug === input.courseSlug ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.purchasedAt.getTime() - b.purchasedAt.getTime()
  })
  const selected = ordered[0]

  if (!selected) return { packagePurchase: null, usage: null, consumed: false }

  for (const candidate of ordered) {
    try {
      const transactionResult = await prisma.$transaction(async (tx) => {
        if (!await guardPackagePurchaseEligibleForCreditTx(tx, candidate)) return null

        if (candidate.isUnlimited && candidate.remainingCredits == null) {
          const usage = await tx.packageUsageLedger.create({
            data: {
              packagePurchaseId: candidate.id,
              userId: input.userId,
              attendanceId: input.attendanceId,
              delta: 0,
              reason: "CHECKIN_UNLIMITED",
              meta: { courseSlug: input.courseSlug || null },
            },
          })
          const updatedPackage = await tx.packagePurchase.update({
            where: { id: candidate.id },
            data: { lastUsedAt: now },
          })
          return { updatedPackage, usage }
        }

        const decremented = await tx.packagePurchase.updateMany({

          where: {
            id: candidate.id,
            status: "active",
            isUnlimited: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            remainingCredits: { gt: 0 },
          },
          data: {
            remainingCredits: { decrement: 1 },
            lastUsedAt: now,
          },
        })

        if (decremented.count === 0) return null

        let updatedPackage = await tx.packagePurchase.findUnique({
          where: { id: candidate.id },
        })
        if (!updatedPackage) return null

        if ((updatedPackage.remainingCredits ?? 0) <= 0 && updatedPackage.status !== "exhausted") {
          updatedPackage = await tx.packagePurchase.update({
            where: { id: candidate.id },
            data: { status: "exhausted" },
          })
        }

        const usage = await tx.packageUsageLedger.create({
          data: {
            packagePurchaseId: candidate.id,
            userId: input.userId,
            attendanceId: input.attendanceId,
            delta: -1,
            reason: "CHECKIN_CLASS",
            meta: { courseSlug: input.courseSlug || null },
          },
        })

        return { updatedPackage, usage }
      })

      if (!transactionResult) continue
      return {
        packagePurchase: transactionResult.updatedPackage,
        usage: transactionResult.usage,
        consumed: transactionResult.usage.delta < 0,
      }
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
      const usage = await prisma.packageUsageLedger.findUnique({
        where: { attendanceId: input.attendanceId },
      })
      if (!usage) throw error
      const linkedPackage = await prisma.packagePurchase.findUnique({
        where: { id: usage.packagePurchaseId },
      })
      return {
        packagePurchase: linkedPackage,
        usage,
        consumed: usage.delta < 0,
      }
    }
  }

  return { packagePurchase: null, usage: null, consumed: false }
}

export const reservePackageCreditForAttendanceTx = async (tx: PrismaTx, input: {
  packagePurchaseId: string
  userId: string
  attendanceId: string
  courseSlug?: string
  at?: Date
  reason?: string
}) => {
  const timestamp = input.at || new Date()
  const reason = input.reason || "PACKAGE_ASSIGNMENT"

  const existingUsage = await tx.packageUsageLedger.findUnique({
    where: { attendanceId: input.attendanceId },
  })
  if (existingUsage) {
    const linkedPackage = await tx.packagePurchase.findUnique({
      where: { id: existingUsage.packagePurchaseId },
    })
    return {
      packagePurchase: linkedPackage,
      usage: existingUsage,
      consumed: existingUsage.delta < 0,
    }
  }

  let selectedPackage = await tx.packagePurchase.findFirst({
    where: {
      id: input.packagePurchaseId,
      userId: input.userId,
      status: "active",
      purchasedAt: { lte: timestamp },
      OR: [{ expiresAt: null }, { expiresAt: { gt: timestamp } }],
    },
  })

  if (!selectedPackage) {
    throw new Error("PACKAGE_NOT_AVAILABLE")
  }

  if (!await guardPackagePurchaseEligibleForCreditTx(tx, selectedPackage)) {
    throw new Error("PACKAGE_PURCHASE_INELIGIBLE")
  }

  if (selectedPackage.isUnlimited && selectedPackage.remainingCredits == null) {
    const usage = await tx.packageUsageLedger.create({
      data: {
        packagePurchaseId: selectedPackage.id,
        userId: input.userId,
        attendanceId: input.attendanceId,
        delta: 0,
        reason,
        meta: { courseSlug: input.courseSlug || null },
      },
    })
    selectedPackage = await tx.packagePurchase.update({
      where: { id: selectedPackage.id },
      data: { lastUsedAt: timestamp },
    })
    return { packagePurchase: selectedPackage, usage, consumed: false }
  }

  const decremented = await tx.packagePurchase.updateMany({
    where: {
      id: selectedPackage.id,
      userId: input.userId,
      status: "active",
      purchasedAt: { lte: timestamp },
      isUnlimited: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: timestamp } }],
      remainingCredits: { gt: 0 },
    },
    data: {
      remainingCredits: { decrement: 1 },
      lastUsedAt: timestamp,
    },
  })

  if (decremented.count === 0) {
    throw new Error("PACKAGE_NO_CREDITS")
  }

  selectedPackage = await tx.packagePurchase.findUnique({
    where: { id: selectedPackage.id },
  })
  if (!selectedPackage) {
    throw new Error("PACKAGE_NOT_FOUND")
  }

  if ((selectedPackage.remainingCredits ?? 0) <= 0 && selectedPackage.status !== "exhausted") {
    selectedPackage = await tx.packagePurchase.update({
      where: { id: selectedPackage.id },
      data: { status: "exhausted" },
    })
  }

  const usage = await tx.packageUsageLedger.create({
    data: {
      packagePurchaseId: selectedPackage.id,
      userId: input.userId,
      attendanceId: input.attendanceId,
      delta: -1,
      reason,
      meta: { courseSlug: input.courseSlug || null },
    },
  })

  return { packagePurchase: selectedPackage, usage, consumed: true }
}

export const reservePackageCreditForAttendance = async (input: {
  packagePurchaseId: string
  userId: string
  attendanceId: string
  courseSlug?: string
  at?: Date
  reason?: string
}) => {
  return reservePackageCreditForAttendanceTx(prisma, input)
}
