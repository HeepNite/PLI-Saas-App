import { NextResponse } from "next/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const NY_TIMEZONE = "America/New_York"
const ACTIVE_ATTENDANCE_STATUSES = ["scheduled", "checked_in", "checked_in_no_package"]

const toDayKeyInNY = (input: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input)
  const year = parts.find((item) => item.type === "year")?.value || "1970"
  const month = parts.find((item) => item.type === "month")?.value || "01"
  const day = parts.find((item) => item.type === "day")?.value || "01"
  return `${year}-${month}-${day}`
}

const toTimeLabelInNY = (input: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(input)

const parseMonthParam = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date()
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  }
  const [yearString, monthString] = value.split("-")
  const year = Number(yearString)
  const month = Number(monthString)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const now = new Date()
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  }
  return { year, month }
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:schedule:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const requestUrl = new URL(req.url)
  const { year, month } = parseMonthParam(requestUrl.searchParams.get("month"))
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const nextMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0))

  const attendances = await prisma.attendance.findMany({
    where: {
      status: { in: ACTIVE_ATTENDANCE_STATUSES },
      session: {
        startsAt: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      session: {
        select: {
          id: true,
          startsAt: true,
          courseSlug: true,
          title: true,
        },
      },
    },
    orderBy: [{ session: { startsAt: "asc" } }],
  })

  const byDay = new Map<
    string,
    Array<{
      attendanceId: string
      status: string
      startsAtIso: string
      timeLabel: string
      courseSlug: string
      courseTitle: string
      userId: string
      userName: string
      userEmail: string
      userPhone: string
    }>
  >()

  for (const item of attendances) {
    const startsAtIso = item.session.startsAt.toISOString()
    const dayKey = toDayKeyInNY(item.session.startsAt)
    const event = {
      attendanceId: item.id,
      status: item.status,
      startsAtIso,
      timeLabel: toTimeLabelInNY(item.session.startsAt),
      courseSlug: item.session.courseSlug,
      courseTitle: item.session.title || item.session.courseSlug,
      userId: item.user.id,
      userName: item.user.name || item.user.email || "Student",
      userEmail: item.user.email || "",
      userPhone: item.user.phone || "",
    }
    const bucket = byDay.get(dayKey)
    if (!bucket) {
      byDay.set(dayKey, [event])
    } else {
      bucket.push(event)
    }
  }

  return NextResponse.json({
    timezone: NY_TIMEZONE,
    month: `${year}-${String(month).padStart(2, "0")}`,
    eventsByDay: Object.fromEntries(byDay.entries()),
  })
}
