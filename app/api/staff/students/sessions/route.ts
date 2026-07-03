import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { findSelectableClassSessions, isSelectableSessionDateKey, isValidSessionDateKey } from "./selectable-sessions"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:students:sessions:get", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStudentOperationalRequest(),
  })
  if (!guard.ok) return guard.response

  const requestUrl = new URL(req.url)
  const date = (requestUrl.searchParams.get("date") || "").trim()
  const now = new Date()
  if (date && !isValidSessionDateKey(date)) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 })
  }
  if (date && !isSelectableSessionDateKey(date, now)) {
    return NextResponse.json({ error: "Date must be today or within the last 14 days." }, { status: 400 })
  }

  const sessions = await findSelectableClassSessions(prisma, now, date || undefined)

  return NextResponse.json({
    items: sessions.map((session) => {
      const startsAtMs = session.startsAt.getTime()
      const endsAtMs = startsAtMs + (session.durationMinutes ?? 60) * 60 * 1000
      return {
        id: session.id,
        courseSlug: session.courseSlug,
        title: session.title || session.courseSlug,
        startsAt: session.startsAt.toISOString(),
        durationMinutes: session.durationMinutes,
        isCurrent: startsAtMs <= now.getTime() && now.getTime() <= endsAtMs,
      }
    }),
  })
}
