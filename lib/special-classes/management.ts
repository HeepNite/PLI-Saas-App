import { Prisma, type PrismaClient } from "@prisma/client"
import { CAPACITY_STATUSES } from "@/lib/special-classes/policy"

const MAX_SERIALIZABLE_ATTEMPTS = 3

const isRetryableConflict = (error: unknown) => {
  if (!error || typeof error !== "object") return false
  const code = Object.hasOwn(error, "code") ? String((error as { code: unknown }).code) : ""
  const meta = Object.hasOwn(error, "meta") ? (error as { meta?: unknown }).meta : null
  const databaseCode = meta && typeof meta === "object" && Object.hasOwn(meta, "code")
    ? String((meta as { code: unknown }).code)
    : ""
  return ["P2002", "P2034"].includes(code) || (code === "P2010" && databaseCode === "40001")
}

export async function runSpecialClassSerializableTransaction<T>(
  db: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!isRetryableConflict(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) throw error
    }
  }
  throw new Error("Unable to complete special class transaction")
}

export async function lockSpecialClassBoundary(tx: Prisma.TransactionClient, specialClassId: string) {
  const initial = await tx.specialClass.findUnique({ where: { id: specialClassId }, select: { classSessionId: true } })
  if (!initial) throw new Error("SPECIAL_CLASS_NOT_FOUND")
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ClassSession" WHERE "id" = ${initial.classSessionId} FOR UPDATE`)
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SpecialClass" WHERE "id" = ${specialClassId} FOR UPDATE`)
  const specialClass = await tx.specialClass.findUnique({ where: { id: specialClassId }, include: { classSession: true } })
  if (!specialClass || specialClass.classSessionId !== initial.classSessionId) throw new Error("SPECIAL_CLASS_CHANGED")
  return specialClass
}

export async function lockAndValidateSpecialClassCapacity(
  tx: Prisma.TransactionClient,
  input: { specialClassId: string; capacity?: number; now: Date },
) {
  const specialClass = await lockSpecialClassBoundary(tx, input.specialClassId)
  await tx.purchase.updateMany({ where: { specialClassId: input.specialClassId, status: "pending", holdExpiresAt: { lte: input.now } }, data: { status: "expired" } })
  const occupied = await tx.purchase.count({
    where: {
      specialClassId: input.specialClassId,
      OR: [{ status: { in: CAPACITY_STATUSES } }, { status: "pending", holdExpiresAt: { gt: input.now } }],
    },
  })
  const currentCapacity = specialClass.classSession.capacity
  // When the caller omits a new capacity, keep the freshly locked value so validation and the
  // subsequent write operate on the same number instead of a stale pre-lock snapshot.
  const effectiveCapacity = input.capacity ?? currentCapacity
  return { specialClass, occupied, currentCapacity, effectiveCapacity, valid: effectiveCapacity >= occupied }
}

export async function updatePublishedSpecialClassCapacity(db: PrismaClient, input: {
  specialClassId: string
  capacity: number
  actorClerkUserId: string
  actorRole: string
  now?: Date
}) {
  return runSpecialClassSerializableTransaction(db, async (tx) => {
    const validation = await lockAndValidateSpecialClassCapacity(tx, { specialClassId: input.specialClassId, capacity: input.capacity, now: input.now ?? new Date() })
    if (!validation.valid) return { ok: false as const, code: "CAPACITY_BELOW_OCCUPANCY" as const }
    const session = await tx.classSession.update({ where: { id: validation.specialClass.classSessionId }, data: { capacity: input.capacity } })
    await tx.specialClassAuditLog.create({ data: {
      specialClassId: validation.specialClass.id,
      classSessionId: validation.specialClass.classSessionId,
      action: "capacity_updated",
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      beforeState: { capacity: validation.currentCapacity },
      afterState: { capacity: input.capacity, occupied: validation.occupied },
      correlationId: crypto.randomUUID(),
    } })
    return { ok: true as const, session }
  })
}
