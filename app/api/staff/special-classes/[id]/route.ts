import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSpecialClassDetail } from "@/lib/special-classes/read-model"
import { canTransitionSpecialClass, isPublishableSpecialClass } from "@/lib/special-classes/policy"
import { authorizeSpecialClassDefinitionRequest, authorizeSpecialClassRosterRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { lockAndValidateSpecialClassCapacity, runSpecialClassSerializableTransaction } from "@/lib/special-classes/management"

const STATUSES = new Set(["draft", "published", "closed", "cancelled"])

const hasMatchingMutationSnapshot = (value: unknown, expected: Record<string, string | number | null>) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const snapshot = value as Record<string, unknown>
  return Object.entries(expected).every(([key, expectedValue]) => snapshot[key] === expectedValue)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, { rateLimit: { scope: "staff:special-class:detail", limit: 120, windowMs: 60_000 }, authorize: authorizeSpecialClassRosterRequest })
  if (!guard.ok) return guard.response
  const detail = await getSpecialClassDetail((await params).id)
  return detail ? NextResponse.json({ item: detail }) : NextResponse.json({ error: "Special class not found" }, { status: 404 })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, { rateLimit: { scope: "staff:special-class:patch", limit: 60, windowMs: 60_000 }, authorize: authorizeSpecialClassDefinitionRequest })
  if (!guard.ok) return guard.response
  const { id } = await params
  const current = await prisma.specialClass.findUnique({ where: { id }, include: { classSession: true } })
  if (!current) return NextResponse.json({ error: "Special class not found" }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const status = typeof body.status === "string" ? body.status : current.status
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Invalid lifecycle status" }, { status: 422 })
  if (!canTransitionSpecialClass(current.status, status)) return NextResponse.json({ error: "Invalid lifecycle transition" }, { status: 409 })
  const title = typeof body.title === "string" ? body.title.trim() : current.title
  const description = typeof body.description === "string" ? body.description.trim() : current.description
  const currency = typeof body.currency === "string" ? body.currency.trim().toLowerCase() : current.currency
  const priceCents = typeof body.priceCents === "number" ? body.priceCents : current.priceCents
  const startsAt = typeof body.startsAt === "string" ? new Date(body.startsAt) : current.classSession.startsAt
  const capacity = typeof body.capacity === "number" ? body.capacity : current.classSession.capacity
  const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : current.classSession.durationMinutes ?? 60
  const location = typeof body.location === "string" ? body.location.trim() || null : current.classSession.location
  const coverImageUrl = typeof body.coverImageUrl === "string" ? body.coverImageUrl.trim() || null : current.coverImageUrl
  const definitionChanged = ["title", "description", "currency", "priceCents", "startsAt", "capacity", "durationMinutes", "location", "coverImageUrl"].some((key) => key in body)
  if (definitionChanged && (current.status === "closed" || current.status === "cancelled")) return NextResponse.json({ error: "Terminal special classes cannot be edited" }, { status: 409 })
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "Invalid special class definition" }, { status: 422 })
  if (status === "published" && !isPublishableSpecialClass({
    startsAt, capacity, title, description, currency, priceCents,
  }, new Date())) return NextResponse.json({ error: "Special class cannot be published" }, { status: 422 })
  const suppliedIdempotencyKey = req.headers.get("x-correlation-id")?.trim()
  if (suppliedIdempotencyKey && suppliedIdempotencyKey.length > 200) return NextResponse.json({ error: "Invalid idempotency key" }, { status: 422 })
  const clientIdempotencyKey = suppliedIdempotencyKey || crypto.randomUUID()
  const updated = await runSpecialClassSerializableTransaction(prisma, async (tx) => {
    const duplicate = await tx.specialClassAuditLog.findUnique({ where: { specialClassId_idempotencyKey: { specialClassId: id, idempotencyKey: clientIdempotencyKey } } })
    if (duplicate) {
      const expectedAction = status === current.status ? "class_updated" : `class_${status}`
      const matchesRequest = duplicate.action === expectedAction && hasMatchingMutationSnapshot(duplicate.afterState, {
        status, title, description, currency, priceCents, coverImageUrl, startsAt: startsAt.toISOString(),
        durationMinutes, capacity, location,
      })
      if (!matchesRequest) throw new Error("IDEMPOTENCY_KEY_REUSED")
      const replayed = await tx.specialClass.findUnique({ where: { id }, include: { classSession: true } })
      if (!replayed) throw new Error("SPECIAL_CLASS_NOT_FOUND")
      return { item: replayed, replayed: true }
    }
    const capacityValidation = await lockAndValidateSpecialClassCapacity(tx, { specialClassId: id, capacity, now: new Date() })
    const lockedCurrent = capacityValidation.specialClass
    if (!canTransitionSpecialClass(lockedCurrent.status, status)) throw new Error("INVALID_LIFECYCLE_TRANSITION")
    if (definitionChanged && (lockedCurrent.status === "closed" || lockedCurrent.status === "cancelled")) throw new Error("TERMINAL_CLASS_EDIT")
    if (!capacityValidation.valid) throw new Error("CAPACITY_BELOW_OCCUPANCY")
    await tx.classSession.update({ where: { id: lockedCurrent.classSessionId }, data: { title, startsAt, durationMinutes, capacity, location } })
    const item = await tx.specialClass.update({ where: { id }, data: {
      status, title, description, currency, priceCents, coverImageUrl,
      publishedAt: status === "published" ? lockedCurrent.publishedAt ?? new Date() : lockedCurrent.publishedAt,
      cancelledAt: status === "cancelled" ? lockedCurrent.cancelledAt ?? new Date() : lockedCurrent.cancelledAt,
    }, include: { classSession: true } })
    await tx.specialClassAuditLog.create({ data: {
      specialClassId: id, classSessionId: lockedCurrent.classSessionId, action: status === lockedCurrent.status ? "class_updated" : `class_${status}`,
      actorClerkUserId: guard.auth.userId, actorRole: guard.auth.role,
      beforeState: {
        status: lockedCurrent.status, title: lockedCurrent.title, description: lockedCurrent.description, currency: lockedCurrent.currency,
        priceCents: lockedCurrent.priceCents, coverImageUrl: lockedCurrent.coverImageUrl, publishedAt: lockedCurrent.publishedAt?.toISOString() ?? null,
        cancelledAt: lockedCurrent.cancelledAt?.toISOString() ?? null, startsAt: lockedCurrent.classSession.startsAt.toISOString(),
        durationMinutes: lockedCurrent.classSession.durationMinutes, capacity: lockedCurrent.classSession.capacity,
        location: lockedCurrent.classSession.location,
      },
      afterState: {
        status, title, description, currency, priceCents, coverImageUrl,
        publishedAt: item.publishedAt?.toISOString() ?? null, cancelledAt: item.cancelledAt?.toISOString() ?? null, startsAt: startsAt.toISOString(),
        durationMinutes, capacity, location, occupied: capacityValidation.occupied,
      },
      correlationId: crypto.randomUUID(), idempotencyKey: clientIdempotencyKey,
    } })
    return { item, replayed: false }
  }).catch((error) => {
    if (error instanceof Error && error.message === "CAPACITY_BELOW_OCCUPANCY") return null
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") return "idempotency_conflict" as const
    if (error instanceof Error && ["INVALID_LIFECYCLE_TRANSITION", "TERMINAL_CLASS_EDIT"].includes(error.message)) return "lifecycle_conflict" as const
    throw error
  })
  if (!updated) return NextResponse.json({ error: "Capacity cannot be lower than active reservations" }, { status: 409 })
  if (updated === "idempotency_conflict") return NextResponse.json({ error: "Idempotency key was already used for a different mutation" }, { status: 409 })
  if (updated === "lifecycle_conflict") return NextResponse.json({ error: "Special class lifecycle changed before this mutation completed" }, { status: 409 })
  return NextResponse.json({ item: updated.item, ...(updated.replayed ? { replayed: true } : {}) })
}
