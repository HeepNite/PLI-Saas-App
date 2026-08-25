import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { findSelectableStudentSessions, isSelectableStudentSessionDate } from "./shared"

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:students:sessions:get", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } })

  const auth = await authorizeStudentOperationalRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const date = new URL(req.url).searchParams.get("date")?.trim() || ""
  if (!date || !isSelectableStudentSessionDate(date)) {
    return NextResponse.json({ error: "Date must be today or within the last 14 days." }, { status: 400 })
  }

  const sessions = await findSelectableStudentSessions(prisma, date)

  return NextResponse.json({ items: sessions.map((session) => ({
    id: session.id,
    courseSlug: session.courseSlug,
    title: session.title,
    startsAt: session.startsAt.toISOString(),
    durationMinutes: session.durationMinutes,
    isCurrent: false,
  })) })
}
