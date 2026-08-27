import { Prisma, type Purchase } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { SPECIAL_CLASS_HOLD_MS } from "@/lib/special-classes/policy"
import { SPECIAL_SALSA_CLASS, resolveSpecialClassPricing } from "@/lib/special-salsa-class/config"

const PAID_STATUSES = ["paid", "succeeded", "completed", "capture_pending"]
const MAX_SERIALIZABLE_ATTEMPTS = 3

type ReservationInput = {
  attemptId: string
  specialClassSlug?: string
  dbUserId: string
  email: string
  name: string
  phone: string
}

export type ReservationResult =
  | {
      ok: true
      kind: "created" | "existing"
      purchase: Purchase
      idempotencyKey: string
      holdExpiresAt: Date
      specialClass: {
        id: string
        slug: string
        title: string
        description: string
        coverImageUrl: string | null
        priceCents: number
        currency: string
        classSessionId: string
        session: { courseSlug: string; startsAt: Date; durationMinutes: number | null; capacity: number; location: string | null }
      }
    }
  | { ok: false; code: "NOT_AVAILABLE" | "CHECKOUT_EXPIRED" | "CHECKOUT_IN_PROGRESS" | "ALREADY_REGISTERED" | "SOLD_OUT" }

export const getSpecialClassIdempotencyKey = (slug: string, attemptId: string) => `special-class:${slug}:${attemptId}`

const retryable = (error: unknown) => {
  if (!error || typeof error !== "object") return false
  const code = Object.hasOwn(error, "code") ? String((error as { code: unknown }).code) : ""
  const meta = Object.hasOwn(error, "meta") ? (error as { meta?: unknown }).meta : null
  const databaseCode = meta && typeof meta === "object" && Object.hasOwn(meta, "code")
    ? String((meta as { code: unknown }).code)
    : ""
  return ["P2002", "P2034"].includes(code) || (code === "P2010" && databaseCode === "40001")
}

export async function admitSpecialClassReservation(
  input: ReservationInput,
  options: { db?: typeof prisma; now?: () => Date } = {},
): Promise<ReservationResult> {
  const db = options.db ?? prisma
  const now = options.now?.() ?? new Date()
  const slug = input.specialClassSlug ?? SPECIAL_SALSA_CLASS.key
  const idempotencyKey = getSpecialClassIdempotencyKey(slug, input.attemptId)

  for (let serializableAttempt = 1; serializableAttempt <= MAX_SERIALIZABLE_ATTEMPTS; serializableAttempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const specialClass = await tx.specialClass.findUnique({
          where: { slug },
          include: { classSession: true },
        })
        if (!specialClass || specialClass.status !== "published" || specialClass.classSession.startsAt <= now) {
          return { ok: false as const, code: "NOT_AVAILABLE" as const }
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ClassSession" WHERE "id" = ${specialClass.classSessionId} FOR UPDATE`)
        if (specialClass.salesOpenAt && specialClass.salesOpenAt > now) return { ok: false as const, code: "NOT_AVAILABLE" as const }
        if (specialClass.salesCloseAt && specialClass.salesCloseAt <= now) return { ok: false as const, code: "NOT_AVAILABLE" as const }

        await tx.purchase.updateMany({
          where: { specialClassId: specialClass.id, status: "pending", holdExpiresAt: { lte: now } },
          data: { status: "expired" },
        })

        const sameAttempt = await tx.purchase.findUnique({ where: { idempotencyKey } })
        if (sameAttempt) {
          if (sameAttempt.userId !== input.dbUserId || sameAttempt.specialClassId !== specialClass.id) {
            return { ok: false as const, code: "CHECKOUT_IN_PROGRESS" as const }
          }
          if (PAID_STATUSES.includes(sameAttempt.status)) return { ok: false as const, code: "ALREADY_REGISTERED" as const }
          if (sameAttempt.status === "pending" && sameAttempt.holdExpiresAt && sameAttempt.holdExpiresAt > now) {
            return {
              ok: true as const,
              kind: "existing" as const,
              purchase: sameAttempt,
              idempotencyKey,
              holdExpiresAt: sameAttempt.holdExpiresAt,
              specialClass: serializeSpecialClass(specialClass, sameAttempt.amount),
            }
          }
          return { ok: false as const, code: "CHECKOUT_EXPIRED" as const }
        }

        const duplicate = await tx.purchase.findFirst({
          where: {
            userId: input.dbUserId,
            specialClassId: specialClass.id,
            OR: [{ status: { in: PAID_STATUSES } }, { status: "pending", holdExpiresAt: { gt: now } }],
          },
        })
        if (duplicate) {
          return PAID_STATUSES.includes(duplicate.status)
            ? { ok: false as const, code: "ALREADY_REGISTERED" as const }
            : { ok: false as const, code: "CHECKOUT_IN_PROGRESS" as const }
        }

        const occupied = await tx.purchase.count({
          where: {
            specialClassId: specialClass.id,
            OR: [{ status: { in: PAID_STATUSES } }, { status: "pending", holdExpiresAt: { gt: now } }],
          },
        })
        if (occupied >= specialClass.classSession.capacity) return { ok: false as const, code: "SOLD_OUT" as const }

        const holdExpiresAt = new Date(now.getTime() + SPECIAL_CLASS_HOLD_MS)
        const priceCents = slug === SPECIAL_SALSA_CLASS.key
          ? resolveSpecialClassPricing(now).amountCents
          : specialClass.priceCents
        const purchase = await tx.purchase.create({
          data: {
            userId: input.dbUserId,
            courseSlug: specialClass.classSession.courseSlug,
            courseTitle: specialClass.title,
            amount: priceCents,
            currency: specialClass.currency,
            status: "pending",
            email: input.email,
            name: input.name,
            phone: input.phone,
            participants: 1,
            serviceId: "special-class",
            idempotencyKey,
            specialClassId: specialClass.id,
            classSessionId: specialClass.classSessionId,
            holdExpiresAt,
            metadata: { specialClassSlug: slug, attemptId: input.attemptId, lockedAmountCents: String(priceCents) },
          },
        })
        return {
          ok: true as const,
          kind: "created" as const,
          purchase,
          idempotencyKey,
          holdExpiresAt,
          specialClass: serializeSpecialClass(specialClass, priceCents),
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!retryable(error) || serializableAttempt === MAX_SERIALIZABLE_ATTEMPTS) throw error
    }
  }
  throw new Error("Unable to admit special class reservation")
}

const serializeSpecialClass = (specialClass: {
  id: string; slug: string; title: string; description: string; coverImageUrl: string | null; priceCents: number; currency: string; classSessionId: string
  classSession: { courseSlug: string; startsAt: Date; durationMinutes: number | null; capacity: number; location: string | null }
}, priceCents = specialClass.priceCents) => ({
  id: specialClass.id,
  slug: specialClass.slug,
  title: specialClass.title,
  description: specialClass.description,
  coverImageUrl: specialClass.coverImageUrl,
  priceCents,
  currency: specialClass.currency,
  classSessionId: specialClass.classSessionId,
  session: specialClass.classSession,
})

export const updateSpecialClassPurchaseSession = (purchaseId: string, stripeSessionId: string) =>
  prisma.purchase.update({ where: { id: purchaseId }, data: { stripeCheckoutSessionId: stripeSessionId } })

export const failSpecialClassHold = (purchaseId: string) =>
  prisma.purchase.updateMany({ where: { id: purchaseId, status: "pending" }, data: { status: "failed" } })

export const releaseSpecialClassHold = (purchaseId: string) =>
  prisma.purchase.updateMany({ where: { id: purchaseId, status: "pending" }, data: { status: "released" } })

export const getSpecialClassAvailability = async (slug: string, now = new Date()) => {
  const specialClass = await prisma.specialClass.findUnique({ where: { slug }, include: { classSession: true } })
  if (!specialClass) return null
  await prisma.purchase.updateMany({ where: { specialClassId: specialClass.id, status: "pending", holdExpiresAt: { lte: now } }, data: { status: "expired" } })
  const [held, paid] = await Promise.all([
    prisma.purchase.count({ where: { specialClassId: specialClass.id, status: "pending", holdExpiresAt: { gt: now } } }),
    prisma.purchase.count({ where: { specialClassId: specialClass.id, status: { in: PAID_STATUSES } } }),
  ])
  const remaining = Math.max(specialClass.classSession.capacity - held - paid, 0)
  return { remaining, soldOut: remaining === 0, held, paid, capacity: specialClass.classSession.capacity }
}
