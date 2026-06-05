import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

/**
 * GET /api/staff/students/[userId]/sessions
 *
 * Returns class sessions available for attendance override for a given student.
 *
 * Date range defaults:
 *   - from: start of current month (pragmatic — covers recent sessions staff would need to correct)
 *   - to: now + 30 days (covers upcoming sessions too)
 *
 * Session relevance:
 *   - Prefers sessions tied to courses the user has interacted with (purchases, existing attendances)
 *   - Falls back to all sessions in range if no course can be inferred — never returns empty
 *     so staff can always manually correct any session.
 *
 * Each session includes existingAttendanceStatus so the UI can show what's already recorded.
 */
export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:sessions:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  // Verify student exists
  const student = await prisma.user.findUnique({ where: { id: userId } })
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  // Parse query params
  const url = new URL(req.url)
  const fromParam = url.searchParams.get("from")
  const toParam = url.searchParams.get("to")
  const courseSlugParam = url.searchParams.get("courseSlug")

  // Default: start of current month to now + 30 days
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const from = fromParam ? new Date(fromParam) : defaultFrom
  const to = toParam ? new Date(toParam) : defaultTo

  // Determine relevant courseSlugs for this user
  let relevantCourseSlugs: string[] = []

  if (courseSlugParam) {
    // Explicit course filter
    relevantCourseSlugs = [courseSlugParam]
  } else {
    // Infer from user's purchases
    const purchases = await prisma.purchase.findMany({
      where: { userId },
      select: { courseSlug: true },
      distinct: ["courseSlug"],
    })
    relevantCourseSlugs = purchases.map((p) => p.courseSlug)

    // Also infer from existing attendances
    const attendances = await prisma.attendance.findMany({
      where: { userId },
      select: { session: { select: { courseSlug: true } } },
    })
    for (const a of attendances) {
      if (a.session?.courseSlug && !relevantCourseSlugs.includes(a.session.courseSlug)) {
        relevantCourseSlugs.push(a.session.courseSlug)
      }
    }

    // Also from active package purchases
    const packages = await prisma.packagePurchase.findMany({
      where: { userId, status: "active" },
      select: { courseSlug: true },
    })
    for (const p of packages) {
      if (p.courseSlug && !relevantCourseSlugs.includes(p.courseSlug)) {
        relevantCourseSlugs.push(p.courseSlug)
      }
    }
  }

  // Build session query
  const sessionWhere: Record<string, unknown> = {
    startsAt: { gte: from, lte: to },
  }

  if (relevantCourseSlugs.length > 0) {
    sessionWhere.courseSlug = { in: relevantCourseSlugs }
  }

  // Fetch sessions
  const sessions = await prisma.classSession.findMany({
    where: sessionWhere,
    orderBy: [{ startsAt: "asc" }],
    take: 200, // reasonable cap for UI
  })

  // If no sessions found from inferred courses, fall back to all sessions in range
  // so staff can still manually correct any session
  if (sessions.length === 0 && relevantCourseSlugs.length > 0) {
    const fallbackSessions = await prisma.classSession.findMany({
      where: { startsAt: { gte: from, lte: to } },
      orderBy: [{ startsAt: "asc" }],
      take: 200,
    })
    sessions.push(...fallbackSessions)
  }

  // Fetch existing attendance statuses for this user across these sessions
  const sessionIds = sessions.map((s) => s.id)
  const existingAttendances = await prisma.attendance.findMany({
    where: {
      userId,
      sessionId: { in: sessionIds },
    },
    include: {
      packageUsage: { select: { packagePurchaseId: true } },
    },
  })

  const attendanceMap = new Map<string, { status: string; paymentSource: "package" | "dropin" | null }>()
  for (const att of existingAttendances) {
    const attendance = att as typeof att & { packageUsage?: { packagePurchaseId: string | null } | null }
    const hasPackageUsage = Boolean(attendance.packageUsage?.packagePurchaseId)
    attendanceMap.set(att.sessionId, {
      status: att.status,
      paymentSource: hasPackageUsage ? "package" : att.status === "checked_in_no_package" ? "dropin" : null,
    })
  }

  const result = sessions.map((s) => {
    const attendance = attendanceMap.get(s.id)

    return {
      id: s.id,
      courseSlug: s.courseSlug,
      title: s.title,
      startsAt: s.startsAt.toISOString(),
      location: s.location,
      existingAttendanceStatus: attendance?.status ?? null,
      existingAttendancePaymentSource: attendance?.paymentSource ?? null,
    }
  })

  return NextResponse.json({
    ok: true,
    data: {
      sessions: result,
      range: { from: from.toISOString(), to: to.toISOString() },
    },
  })
}
