import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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
  authoringSlot: { courseCatalog: { id: string; title: string } } | null
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
    authoringCourse: specialClass.authoringSlot?.courseCatalog ?? null,
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
      authoringSlot: { select: { courseCatalog: { select: { id: true, title: true } } } },
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
  return NextResponse.json(
    { error: "Create Special Classes in Course Studio." },
    { status: 405, headers: { Allow: "GET" } },
  )
}
