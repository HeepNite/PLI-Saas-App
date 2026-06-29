import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { findSelectableClassSessions, isSelectableSessionDateKey, isValidSessionDateKey } from "./selectable-sessions"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:students:sessions:get", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStudentOperationalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

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
