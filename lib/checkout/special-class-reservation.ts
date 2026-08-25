import { prisma } from "@/lib/prisma"
import {
  SPECIAL_SALSA_CLASS,
  getSpecialClassHoldCreatedAt,
  getSpecialClassHoldCutoff,
  resolveSpecialClassPricing,
} from "@/lib/special-salsa-class/config"

type PurchaseRecord = {
  id: string
  userId?: string
  courseSlug?: string
  amount: number
  status: string
  stripeCheckoutSessionId: string | null
  createdAt?: Date
  metadata?: unknown
}

type TransactionClient = {
  classSession: { upsert: (input: unknown) => Promise<unknown> }
  purchase: {
    findUnique: (input: unknown) => Promise<PurchaseRecord | null>
    findFirst: (input: unknown) => Promise<PurchaseRecord | null>
    count: (input: unknown) => Promise<number>
    create: (input: unknown) => Promise<PurchaseRecord>
    updateMany: (input: unknown) => Promise<{ count: number }>
  }
}

type ReservationDatabase = {
  $transaction: <T>(callback: (tx: TransactionClient) => Promise<T>, options: { isolationLevel: "Serializable" }) => Promise<T>
}

type HoldDatabase = {
  purchase: {
    updateMany: (input: unknown) => Promise<{ count: number }>
  }
}

type ReservationInput = {
  attemptId: string
  dbUserId: string
  email: string
  name: string
  phone: string
  holdExpiresAt: Date
}

export type ReservationResult =
  | {
      ok: true
      kind: "created" | "existing"
      purchase: PurchaseRecord
      idempotencyKey: string
      holdExpiresAt: Date
    }
  | { ok: false; code: "CHECKOUT_EXPIRED" | "CHECKOUT_IN_PROGRESS" | "ALREADY_REGISTERED" | "SOLD_OUT" }

const SUCCESSFUL_STATUSES = ["paid", "succeeded", "completed"]
const MAX_SERIALIZABLE_ATTEMPTS = 3

export const getSpecialClassIdempotencyKey = (attemptId: string) =>
  `${SPECIAL_SALSA_CLASS.key}:${attemptId}`

const isRetryableReservationConflict = (error: unknown) => {
  if (!error || typeof error !== "object" || !Object.hasOwn(error, "code")) return false
  const code = (error as { code?: unknown }).code
  return code === "P2002" || code === "P2034"
}

const readHoldExpiresAt = (purchase: PurchaseRecord) => {
  if (!purchase.metadata || typeof purchase.metadata !== "object" || Array.isArray(purchase.metadata)) return null
  const metadata = purchase.metadata as Record<string, unknown>
  if (typeof metadata.holdExpiresAt !== "string") return null
  const holdExpiresAt = new Date(metadata.holdExpiresAt)
  if (!Number.isFinite(holdExpiresAt.getTime())) return null
  return new Date(Math.floor(holdExpiresAt.getTime() / 1000) * 1000)
}

export async function admitSpecialClassReservation(
  input: ReservationInput,
  options: { db?: ReservationDatabase; now?: () => Date } = {},
): Promise<ReservationResult> {
  const db = options.db || (prisma as unknown as ReservationDatabase)
  const now = options.now?.() || new Date()
  const pricing = resolveSpecialClassPricing(now)
  const idempotencyKey = getSpecialClassIdempotencyKey(input.attemptId)
  const holdExpiresAt = new Date(Math.floor(input.holdExpiresAt.getTime() / 1000) * 1000)
  if (!Number.isFinite(holdExpiresAt.getTime()) || holdExpiresAt <= now) {
    return { ok: false, code: "CHECKOUT_EXPIRED" }
  }
  const holdCreatedAt = getSpecialClassHoldCreatedAt(holdExpiresAt)

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.classSession.upsert({
          where: {
            courseSlug_startsAt: {
              courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
              startsAt: SPECIAL_SALSA_CLASS.startsAt,
            },
          },
          update: {
            title: SPECIAL_SALSA_CLASS.title,
            durationMinutes: SPECIAL_SALSA_CLASS.durationMinutes,
            capacity: SPECIAL_SALSA_CLASS.capacity,
            location: SPECIAL_SALSA_CLASS.address,
          },
          create: {
            courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
            title: SPECIAL_SALSA_CLASS.title,
            startsAt: SPECIAL_SALSA_CLASS.startsAt,
            durationMinutes: SPECIAL_SALSA_CLASS.durationMinutes,
            capacity: SPECIAL_SALSA_CLASS.capacity,
            location: SPECIAL_SALSA_CLASS.address,
          },
        })

        const sameAttempt = await tx.purchase.findUnique({ where: { idempotencyKey } })
        if (sameAttempt) {
          const belongsToCustomer = sameAttempt.userId === undefined || sameAttempt.userId === input.dbUserId
          const belongsToEvent = sameAttempt.courseSlug === undefined || sameAttempt.courseSlug === SPECIAL_SALSA_CLASS.courseSlug
          if (!belongsToCustomer || !belongsToEvent) return { ok: false, code: "CHECKOUT_IN_PROGRESS" }
          if (SUCCESSFUL_STATUSES.includes(sameAttempt.status)) return { ok: false, code: "ALREADY_REGISTERED" }
          if (sameAttempt.status === "pending") {
            const persistedExpiry = readHoldExpiresAt(sameAttempt)
            if (persistedExpiry && persistedExpiry > now) {
              return {
                ok: true,
                kind: "existing",
                purchase: sameAttempt,
                idempotencyKey,
                holdExpiresAt: persistedExpiry,
              }
            }
            await tx.purchase.updateMany({
              where: { id: sameAttempt.id, status: "pending" },
              data: { status: "expired" },
            })
            return { ok: false, code: "CHECKOUT_EXPIRED" }
          }
          return { ok: false, code: "CHECKOUT_IN_PROGRESS" }
        }

        const existingReservation = await tx.purchase.findFirst({
          where: {
            userId: input.dbUserId,
            courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
            OR: [
              { status: { in: SUCCESSFUL_STATUSES } },
              { status: "pending", createdAt: { gt: getSpecialClassHoldCutoff(now) } },
            ],
          },
          orderBy: { createdAt: "desc" },
        })
        if (existingReservation) {
          return SUCCESSFUL_STATUSES.includes(existingReservation.status)
            ? { ok: false, code: "ALREADY_REGISTERED" }
            : { ok: false, code: "CHECKOUT_IN_PROGRESS" }
        }

        const countedSpots = await tx.purchase.count({
          where: {
            courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
            OR: [
              { status: { in: SUCCESSFUL_STATUSES } },
              { status: "pending", createdAt: { gt: getSpecialClassHoldCutoff(now) } },
            ],
          },
        })
        if (countedSpots >= SPECIAL_SALSA_CLASS.capacity) return { ok: false, code: "SOLD_OUT" }

        const purchase = await tx.purchase.create({
          data: {
            userId: input.dbUserId,
            courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
            courseTitle: SPECIAL_SALSA_CLASS.title,
            amount: pricing.amountCents,
            currency: SPECIAL_SALSA_CLASS.currency,
            status: "pending",
            email: input.email,
            name: input.name,
            phone: input.phone,
            participants: 1,
            serviceId: SPECIAL_SALSA_CLASS.checkoutKind,
            idempotencyKey,
            createdAt: holdCreatedAt,
            metadata: {
              specialEventKey: SPECIAL_SALSA_CLASS.key,
              attemptId: input.attemptId,
              lockedAmountCents: String(pricing.amountCents),
              holdExpiresAt: holdExpiresAt.toISOString(),
            },
          },
        })
        return { ok: true, kind: "created", purchase, idempotencyKey, holdExpiresAt }
      }, { isolationLevel: "Serializable" })
    } catch (error) {
      if (!isRetryableReservationConflict(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) throw error
    }
  }
  throw new Error("Unable to admit special class reservation")
}

export const updateSpecialClassPurchaseSession = (purchaseId: string, sessionId: string) =>
  prisma.purchase.update({ where: { id: purchaseId }, data: { stripeCheckoutSessionId: sessionId } })

export const preserveSpecialClassHold = (
  input: {
    purchaseId: string
    sessionId: string
    currentMetadata: unknown
    holdExpiresAt: Date
  },
  options: { db?: HoldDatabase } = {},
) => {
  const db = options.db || (prisma as unknown as HoldDatabase)
  const holdExpiresAt = new Date(Math.floor(input.holdExpiresAt.getTime() / 1000) * 1000)
  const currentMetadata = input.currentMetadata && typeof input.currentMetadata === "object" && !Array.isArray(input.currentMetadata)
    ? input.currentMetadata as Record<string, unknown>
    : {}

  return db.purchase.updateMany({
    where: { id: input.purchaseId, status: "pending" },
    data: {
      stripeCheckoutSessionId: input.sessionId,
      createdAt: getSpecialClassHoldCreatedAt(holdExpiresAt),
      metadata: { ...currentMetadata, holdExpiresAt: holdExpiresAt.toISOString() },
    },
  })
}

export const failSpecialClassHold = (purchaseId: string) =>
  prisma.purchase.updateMany({ where: { id: purchaseId, status: "pending" }, data: { status: "failed" } })

export const getSpecialClassAvailability = async (now = new Date()) => {
  const counted = await prisma.purchase.count({
    where: {
      courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
      OR: [
        { status: { in: SUCCESSFUL_STATUSES } },
        { status: "pending", createdAt: { gt: getSpecialClassHoldCutoff(now) } },
      ],
    },
  })
  return { remaining: Math.max(SPECIAL_SALSA_CLASS.capacity - counted, 0), soldOut: counted >= SPECIAL_SALSA_CLASS.capacity }
}
