import { Prisma, type PrismaClient } from "@prisma/client"
import { findOverlappingRoomSession } from "@/lib/class-schedule"
import {
  createStableSpecialClassSlug,
  hashAuthoringPayload,
  isGeneratedSlotMutationBlocked,
  mapInitialSpecialClassProjection,
  normalizeConcreteSpecialClassSlots,
  type ConcreteSpecialClassSlotInput,
  type SpecialClassAuthoringIntent,
} from "@/lib/special-classes/authoring-policy"
import { isSpecialClassRetryableConflict, lockSpecialClassBoundary, runSpecialClassSerializableTransaction } from "@/lib/special-classes/management"
type CourseInput = {
  slug: string; title: string; kind: string; category: string | null; description: string | null
  coverImageUrl: string | null; previewVideoUrl: string | null; dropInPriceCents: number | null
  firstClassPriceCents: number | null; level: string | null; durationMinutes: number | null
  location: string | null; defaultRoomId: string | null; availableWeekdays: number[]; availableTimes: string[]
  scheduleRules: Prisma.InputJsonValue | null; active: boolean; specialClassOperationsEnabled: boolean
  specialClassCapacity: number | null
}
export type SpecialClassAuthoringInput = {
  operationId: string
  intent: SpecialClassAuthoringIntent
  courseCatalogId?: string
  expectedUpdatedAt?: string
  course: CourseInput
  concreteSlots: ConcreteSpecialClassSlotInput[]
  actorClerkUserId: string
  actorRole: string
}
type ProjectionSummary = { slotId: string; specialClassId: string; classSessionId: string; slug: string; status: string }
type RemovalOutcome = {
  action: "authoring_removed" | "authoring_disabled"; courseCatalogId: string; slotId: string; specialClassId: string; classSessionId: string
  actorClerkUserId: string; actorRole: string; beforeState: { status: string; startsAt: string }; afterState: { status: "removed" | "disabled" }
  operationId: string; correlationId: string
}
export type SpecialClassAuthoringResult = { courseCatalogId: string; revision: string; projections: ProjectionSummary[]; removedSlotIds: string[]; removalOutcomes: RemovalOutcome[] }
export type SpecialClassAuthoringWriteStage = "course" | "slot" | "projection" | "audit" | "receipt"
export class SpecialClassAuthoringError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code) }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (code: string, status = 409): never => { throw new SpecialClassAuthoringError(code, status) }
const json = (value: Prisma.InputJsonValue | null) => value === null ? Prisma.JsonNull : value
const hasCommitments = async (tx: Prisma.TransactionClient, specialClassId: string, classSessionId: string) => {
  const [purchases, attendances] = await Promise.all([
    tx.purchase.count({ where: { specialClassId } }),
    tx.attendance.count({ where: { sessionId: classSessionId } }),
  ])
  return isGeneratedSlotMutationBlocked({ holds: 0, purchases, attendances })
}
const assertRoomAvailable = async (tx: Prisma.TransactionClient, input: {
  roomId: string | null; startsAt: Date; durationMinutes: number | null; excludeSessionId?: string
}) => {
  if (!input.roomId) return
  const sessions = await tx.classSession.findMany({ where: { roomId: input.roomId } })
  if (findOverlappingRoomSession(sessions, input)) fail("ROOM_CONFLICT")
  const endsAt = new Date(input.startsAt.getTime() + (input.durationMinutes ?? 0) * 60_000)
  const reservation = await tx.roomReservation.findFirst({ where: {
    roomId: input.roomId, status: "active", startsAt: { lt: endsAt }, endsAt: { gt: input.startsAt },
  } })
  if (reservation) fail("ROOM_CONFLICT")
}
const courseData = (course: CourseInput) => ({ ...course, scheduleRules: json(course.scheduleRules) })
const removalOutcome = (input: SpecialClassAuthoringInput, courseCatalogId: string, slotId: string, specialClass: {
  id: string; classSessionId: string; status: string; classSession: { startsAt: Date }
}, action: RemovalOutcome["action"]): RemovalOutcome => ({
  action, courseCatalogId, slotId, specialClassId: specialClass.id, classSessionId: specialClass.classSessionId,
  actorClerkUserId: input.actorClerkUserId, actorRole: input.actorRole,
  beforeState: { status: specialClass.status, startsAt: specialClass.classSession.startsAt.toISOString() },
  afterState: { status: action === "authoring_removed" ? "removed" : "disabled" },
  operationId: input.operationId, correlationId: input.operationId,
})
export async function synchronizeSpecialClassAuthoring(
  db: PrismaClient,
  input: SpecialClassAuthoringInput,
  hooks: { afterWrite?: (stage: SpecialClassAuthoringWriteStage) => void | Promise<void> } = {},
): Promise<SpecialClassAuthoringResult> {
  if (!UUID.test(input.operationId) || !["save_draft", "publish"].includes(input.intent)) fail("INVALID_AUTHORING_COMMAND", 400)
  const slots = (() => {
    try { return normalizeConcreteSpecialClassSlots(input.concreteSlots) } catch { throw new SpecialClassAuthoringError("INVALID_AUTHORING_COMMAND", 400) }
  })()
  if (slots.some(({ id }) => id && !UUID.test(id)) || new Set(slots.flatMap(({ id }) => id ? [id] : [])).size !== slots.filter(({ id }) => id).length) {
    fail("SLOT_ID_MISMATCH")
  }
  if (input.course.specialClassOperationsEnabled) {
    const complete = slots.length > 0 && input.course.description && input.course.durationMinutes && input.course.durationMinutes > 0 &&
      input.course.dropInPriceCents && input.course.dropInPriceCents > 0 && input.course.specialClassCapacity && input.course.specialClassCapacity > 0 &&
      (input.course.location || input.course.defaultRoomId) && slots.every(({ startsAt }) => startsAt > new Date())
    if (!complete) fail("NOT_PUBLISHABLE", 422)
  }
  const payloadHash = hashAuthoringPayload({ ...input, actorClerkUserId: undefined, actorRole: undefined, concreteSlots: slots })
  try {
    return await runSpecialClassSerializableTransaction(db, async (tx) => {
      const receipt = await tx.courseCatalogAuthoringOperation.findUnique({ where: { operationId: input.operationId } })
      if (receipt) {
        if (receipt.payloadHash !== payloadHash) fail("IDEMPOTENCY_KEY_REUSED")
        return receipt.resultSummary as unknown as SpecialClassAuthoringResult
      }

      let existing = null
      if (input.courseCatalogId) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CourseCatalog" WHERE "id" = ${input.courseCatalogId} FOR UPDATE`)
        const lockedCourse = await tx.courseCatalog.findUnique({ where: { id: input.courseCatalogId }, include: { specialClassSlots: { include: { specialClass: { include: { classSession: true } } } } } })
        if (!lockedCourse) throw new SpecialClassAuthoringError("AUTHORING_CONFLICT")
        if (!input.expectedUpdatedAt || lockedCourse.updatedAt.toISOString() !== input.expectedUpdatedAt) fail("AUTHORING_CONFLICT")
        existing = lockedCourse
      } else if (await tx.courseCatalog.findUnique({ where: { slug: input.course.slug } })) {
        fail("AUTHORING_CONFLICT")
      }

      const storedSlots = existing?.specialClassSlots ?? []
      if (storedSlots.some(({ specialClass }) => specialClass) && existing?.slug !== input.course.slug) fail("AUTHORING_CONFLICT")
      const storedById = new Map(storedSlots.map((slot) => [slot.id, slot]))
      if (slots.some(({ id }) => id && !storedById.has(id))) fail("SLOT_ID_MISMATCH")
      const desiredIds = new Set(slots.flatMap(({ id }) => id ? [id] : []))
      const removed = storedSlots.filter(({ id }) => !desiredIds.has(id))

      for (const slot of [...storedSlots].sort((a, b) => a.id.localeCompare(b.id))) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CourseCatalogSpecialClassSlot" WHERE "id" = ${slot.id}::uuid FOR UPDATE`)
      const lockedBySlot = new Map<string, Awaited<ReturnType<typeof lockSpecialClassBoundary>>>()
      for (const slot of storedSlots.filter(({ specialClass }) => specialClass).sort((a, b) => a.id.localeCompare(b.id))) {
        lockedBySlot.set(slot.id, await lockSpecialClassBoundary(tx, slot.specialClass!.id))
      }
      const discarded = input.course.specialClassOperationsEnabled ? removed : storedSlots
      for (const slot of discarded) {
        if (slot.specialClass && !["draft", "published"].includes(slot.specialClass.status)) fail("SLOT_LIFECYCLE_CONFLICT")
        if (slot.specialClass && await hasCommitments(tx, slot.specialClass.id, slot.specialClass.classSessionId)) fail("SLOT_COMMITTED")
      }

      const savedCourse = existing
        ? await tx.courseCatalog.update({ where: { id: existing.id }, data: courseData(input.course) })
        : await tx.courseCatalog.create({ data: courseData(input.course) })
      await hooks.afterWrite?.("course")

      const removedSlotIds: string[] = []
      const removalOutcomes: RemovalOutcome[] = []
      for (const slot of removed) {
        if (slot.specialClass) {
          removalOutcomes.push(removalOutcome(input, savedCourse.id, slot.id, slot.specialClass, "authoring_removed"))
          await tx.specialClass.delete({ where: { id: slot.specialClass.id } })
          await tx.classSession.delete({ where: { id: slot.specialClass.classSessionId } })
        }
        await tx.courseCatalogSpecialClassSlot.delete({ where: { id: slot.id } })
        removedSlotIds.push(slot.id)
      }
      if (!input.course.specialClassOperationsEnabled) for (const slot of storedSlots.filter(({ id, specialClass }) => desiredIds.has(id) && specialClass)) {
        removalOutcomes.push(removalOutcome(input, savedCourse.id, slot.id, slot.specialClass!, "authoring_disabled"))
        await tx.specialClass.delete({ where: { id: slot.specialClass!.id } })
        await tx.classSession.delete({ where: { id: slot.specialClass!.classSessionId } })
      }

      const projections: ProjectionSummary[] = []
      for (const desired of slots) {
        const stored = desired.id ? storedById.get(desired.id) : null
        const currentSpecialClass = stored ? lockedBySlot.get(stored.id) ?? stored.specialClass : null
        const moved = Boolean(currentSpecialClass && currentSpecialClass.classSession.startsAt.getTime() !== desired.startsAt.getTime())
        if (currentSpecialClass && !["draft", "published"].includes(currentSpecialClass.status)) {
          if (moved) fail("SLOT_LIFECYCLE_CONFLICT")
          projections.push({ slotId: stored!.id, specialClassId: currentSpecialClass.id, classSessionId: currentSpecialClass.classSessionId, slug: currentSpecialClass.slug, status: currentSpecialClass.status })
          continue
        }
        const slot = stored
          ? await tx.courseCatalogSpecialClassSlot.update({ where: { id: stored.id }, data: { startsAt: desired.startsAt } })
          : await tx.courseCatalogSpecialClassSlot.create({ data: { courseCatalogId: savedCourse.id, startsAt: desired.startsAt } })
        await hooks.afterWrite?.("slot")
        if (!input.course.specialClassOperationsEnabled) continue

        const collision = await tx.classSession.findUnique({ where: { courseSlug_startsAt: { courseSlug: savedCourse.slug, startsAt: desired.startsAt } } })
        if (collision && collision.id !== currentSpecialClass?.classSessionId) fail("SLOT_ALREADY_EXISTS")
        await assertRoomAvailable(tx, { roomId: input.course.defaultRoomId, startsAt: desired.startsAt, durationMinutes: input.course.durationMinutes, excludeSessionId: currentSpecialClass?.classSessionId })
        const initial = mapInitialSpecialClassProjection({ intent: input.intent, dropInPriceCents: input.course.dropInPriceCents! })
        let specialClass = currentSpecialClass
        let action = "authoring_created"
        if (!specialClass) {
          const session = await tx.classSession.create({ data: { courseSlug: savedCourse.slug, title: savedCourse.title, startsAt: desired.startsAt, durationMinutes: savedCourse.durationMinutes, capacity: savedCourse.specialClassCapacity!, location: savedCourse.location, roomId: savedCourse.defaultRoomId } })
          specialClass = await tx.specialClass.create({ data: { slug: createStableSpecialClassSlug(savedCourse.slug, slot.id), status: initial.status, classSessionId: session.id, authoringSlotId: slot.id, title: savedCourse.title, description: savedCourse.description!, coverImageUrl: savedCourse.coverImageUrl, currency: initial.currency, priceCents: initial.priceCents, publishedAt: initial.status === "published" ? new Date() : null, createdBy: input.actorClerkUserId }, include: { classSession: true } })
        } else {
          if (moved && await hasCommitments(tx, specialClass.id, specialClass.classSessionId)) fail("SLOT_COMMITTED")
          if (!["draft", "published"].includes(specialClass.status) && moved) fail("SLOT_LIFECYCLE_CONFLICT")
          action = moved ? "authoring_moved" : "authoring_updated"
          await tx.classSession.update({ where: { id: specialClass.classSessionId }, data: { title: savedCourse.title, startsAt: desired.startsAt, durationMinutes: savedCourse.durationMinutes, location: savedCourse.location, roomId: savedCourse.defaultRoomId, ...(specialClass.status === "draft" ? { capacity: savedCourse.specialClassCapacity! } : {}) } })
          specialClass = await tx.specialClass.update({ where: { id: specialClass.id }, data: { title: savedCourse.title, description: savedCourse.description!, coverImageUrl: savedCourse.coverImageUrl, ...(specialClass.status === "draft" ? { priceCents: initial.priceCents, ...(input.intent === "publish" ? { status: "published", publishedAt: new Date() } : {}) } : {}) }, include: { classSession: true } })
        }
        await hooks.afterWrite?.("projection")
        await tx.specialClassAuditLog.create({ data: { specialClassId: specialClass!.id, classSessionId: specialClass!.classSessionId, action, actorClerkUserId: input.actorClerkUserId, actorRole: input.actorRole, beforeState: currentSpecialClass ? { startsAt: currentSpecialClass.classSession.startsAt } : Prisma.JsonNull, afterState: { courseCatalogId: savedCourse.id, authoringSlotId: slot.id, startsAt: desired.startsAt, status: specialClass!.status }, correlationId: input.operationId, idempotencyKey: input.operationId } })
        await hooks.afterWrite?.("audit")
        projections.push({ slotId: slot.id, specialClassId: specialClass!.id, classSessionId: specialClass!.classSessionId, slug: specialClass!.slug, status: specialClass!.status })
      }

      const result = { courseCatalogId: savedCourse.id, revision: savedCourse.updatedAt.toISOString(), projections, removedSlotIds, removalOutcomes }
      await tx.courseCatalogAuthoringOperation.create({ data: { operationId: input.operationId, courseCatalogId: savedCourse.id, payloadHash, resultSummary: result } })
      await hooks.afterWrite?.("receipt")
      return result
    })
  } catch (error) {
    if (error instanceof SpecialClassAuthoringError) throw error
    if (isSpecialClassRetryableConflict(error)) fail("AUTHORING_CONFLICT")
    throw error
  }
}
