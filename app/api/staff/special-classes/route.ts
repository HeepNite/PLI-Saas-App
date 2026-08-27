import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isPublishableSpecialClass } from "@/lib/special-classes/policy"
import {
  authorizeSpecialClassDefinitionRequest,
  authorizeSpecialClassRosterRequest,
} from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"

export const runtime = "nodejs"

const paidStatuses = ["paid", "succeeded", "completed", "capture_pending"]

const summarize = (specialClass: {
  id: string
  slug: string
  status: string
  title: string
  priceCents: number
  currency: string
  classSession: { id: string; startsAt: Date; capacity: number }
  purchases: { status: string; holdExpiresAt: Date | null }[]
  attendances: { status: string }[]
}, now: Date) => {
  const held = specialClass.purchases.filter((purchase) => purchase.status === "pending" && purchase.holdExpiresAt !== null && purchase.holdExpiresAt > now).length
  const paid = specialClass.purchases.filter((purchase) => paidStatuses.includes(purchase.status)).length
  const checkedIn = specialClass.attendances.filter((attendance) => attendance.status.startsWith("checked_in")).length
  return {
    id: specialClass.id,
    slug: specialClass.slug,
    status: specialClass.status,
    title: specialClass.title,
    priceCents: specialClass.priceCents,
    currency: specialClass.currency,
    session: specialClass.classSession,
    capacity: specialClass.classSession.capacity,
    held,
    paid,
    checkedIn,
    remaining: Math.max(specialClass.classSession.capacity - held - paid, 0),
  }
}

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:special-classes:get", limit: 120, windowMs: 60_000 },
    authorize: authorizeSpecialClassRosterRequest,
  })
  if (!guard.ok) return guard.response
  const now = new Date()
  const classes = await prisma.specialClass.findMany({
    include: {
      classSession: true,
      purchases: { select: { status: true, holdExpiresAt: true } },
      auditLogs: { take: 0 },
    },
    orderBy: { classSession: { startsAt: "asc" } },
  })
  const sessionIds = classes.map((specialClass) => specialClass.classSessionId)
  const attendances = await prisma.attendance.findMany({ where: { sessionId: { in: sessionIds } }, select: { sessionId: true, status: true } })
  return NextResponse.json({ items: classes.map((specialClass) => summarize({ ...specialClass, attendances: attendances.filter((attendance) => attendance.sessionId === specialClass.classSessionId) }, now)) })
}

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:special-classes:post", limit: 30, windowMs: 60_000 },
    authorize: authorizeSpecialClassDefinitionRequest,
  })
  if (!guard.ok) return guard.response
  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const startsAt = typeof body.startsAt === "string" ? new Date(body.startsAt) : new Date(0)
  const capacity = typeof body.capacity === "number" ? body.capacity : 0
  const priceCents = typeof body.priceCents === "number" ? body.priceCents : 0
  const currency = typeof body.currency === "string" ? body.currency.trim().toLowerCase() : ""
  if (!/^[a-z0-9-]{3,100}$/.test(slug) || !isPublishableSpecialClass({ startsAt, capacity, title, description, currency, priceCents }, new Date())) {
    return NextResponse.json({ error: "Invalid special class definition" }, { status: 422 })
  }
  const courseSlug = typeof body.courseSlug === "string" && body.courseSlug.trim() ? body.courseSlug.trim() : `special-${slug}`
  const durationMinutes = typeof body.durationMinutes === "number" && Number.isInteger(body.durationMinutes) && body.durationMinutes > 0 ? body.durationMinutes : 60
  const location = typeof body.location === "string" ? body.location.trim() || null : null
  const coverImageUrl = typeof body.coverImageUrl === "string" ? body.coverImageUrl.trim() || null : null
  const idempotencyKey = req.headers.get("x-correlation-id")?.trim() || null
  if (idempotencyKey && idempotencyKey.length > 200) return NextResponse.json({ error: "Invalid idempotency key" }, { status: 422 })
  try {
    const specialClass = await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.create({ data: { courseSlug, title, startsAt, durationMinutes, capacity, location } })
      const item = await tx.specialClass.create({
        data: { slug, title, description, coverImageUrl, currency, priceCents, classSessionId: session.id, createdBy: guard.auth.userId },
        include: { classSession: true },
      })
      await tx.specialClassAuditLog.create({ data: {
        specialClassId: item.id, classSessionId: session.id, action: "class_created",
        actorClerkUserId: guard.auth.userId, actorRole: guard.auth.role,
        afterState: {
          specialClass: {
            id: item.id,
            slug: item.slug,
            status: item.status,
            classSessionId: session.id,
            title: item.title,
            description: item.description,
            coverImageUrl: item.coverImageUrl,
            currency: item.currency,
            priceCents: item.priceCents,
            salesOpenAt: item.salesOpenAt?.toISOString() ?? null,
            salesCloseAt: item.salesCloseAt?.toISOString() ?? null,
            publishedAt: item.publishedAt?.toISOString() ?? null,
            cancelledAt: item.cancelledAt?.toISOString() ?? null,
            createdBy: item.createdBy,
          },
          classSession: {
            id: session.id,
            courseSlug: session.courseSlug,
            title: session.title,
            startsAt: session.startsAt.toISOString(),
            durationMinutes: session.durationMinutes,
            capacity: session.capacity,
            location: session.location,
          },
        },
        correlationId: crypto.randomUUID(),
        idempotencyKey,
      } })
      return item
    })
    return NextResponse.json({ item: { ...specialClass, capacity: specialClass.classSession.capacity } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "A special class with this session or slug already exists." }, { status: 409 })
  }
}
