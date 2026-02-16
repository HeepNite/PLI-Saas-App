import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" })
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/New_York",
})

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "America/New_York",
})

const startOfWeekUtc = (date: Date) => {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = copy.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + diff)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

const getStreakWeeks = (dates: Date[]) => {
  if (!dates.length) return 0
  const weekKeys = new Set(dates.map((date) => startOfWeekUtc(date).toISOString()))
  const nowWeek = startOfWeekUtc(new Date())
  let streak = 0
  for (;;) {
    const key = nowWeek.toISOString()
    if (!weekKeys.has(key)) break
    streak += 1
    nowWeek.setUTCDate(nowWeek.getUTCDate() - 7)
  }
  return streak
}

const getRecurringLabel = (dates: Date[]) => {
  if (!dates.length) return null
  const counts = new Map<string, number>()
  for (const date of dates) {
    const key = `${weekdayFormatter.format(date)}|${timeFormatter.format(date)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return best ? best[0].replace("|", " ") : null
}

export async function GET(req?: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:activity:get", getClientIp(req)),
      limit: 90,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name,
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const attendances = await prisma.attendance.findMany({
      where: { userId: dbUser.id, status: { in: ["checked_in", "checked_in_no_package"] } },
      include: { session: true },
      orderBy: { checkedInAt: "desc" },
      take: 120,
    })

    const attendanceDates = attendances.map((attendance) => attendance.checkedInAt)
    const classesTaken = attendances.length
    const recentWindowWeeks = 8
    const recentCutoff = new Date(Date.now() - recentWindowWeeks * 7 * 24 * 60 * 60 * 1000)
    const recentCount = attendanceDates.filter((date) => date >= recentCutoff).length
    const weeklyAverage = recentCount / recentWindowWeeks
    const streakWeeks = getStreakWeeks(attendanceDates)
    const recurringLabel = getRecurringLabel(attendanceDates)
    const lastAttendance = attendances[0]

    const now = new Date()
    const monthlyBuckets = [...Array(4)].map((_, idx) => {
      const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (3 - idx), 1))
      const key = `${base.getUTCFullYear()}-${base.getUTCMonth()}`
      return { key, label: monthFormatter.format(base), count: 0 }
    })

    for (const date of attendanceDates) {
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
      const bucket = monthlyBuckets.find((item) => item.key === key)
      if (bucket) bucket.count += 1
    }

    return NextResponse.json({
      stats: {
        classesTaken,
        weeklyAverage: Number(weeklyAverage.toFixed(1)),
        streakWeeks,
        recurringLabel,
        lastClassLabel: lastAttendance
          ? `${weekdayFormatter.format(lastAttendance.checkedInAt)} ${timeFormatter.format(lastAttendance.checkedInAt)}`
          : null,
      },
      monthlyAttendance: monthlyBuckets.map((item) => ({ label: item.label, value: item.count })),
      recentAttendances: attendances.slice(0, 8).map((item) => ({
        id: item.id,
        checkedInAt: item.checkedInAt.toISOString(),
        courseSlug: item.session.courseSlug,
        courseTitle: item.session.title,
      })),
    })
  } catch (error) {
    console.error("Profile activity GET failed", error)
    return NextResponse.json({ error: "Unable to load activity" }, { status: 500 })
  }
}
