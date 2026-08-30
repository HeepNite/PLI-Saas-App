import { NextRequest, NextResponse } from "next/server"
import { buildTodayTerminalClasses, getTerminalDayRange } from "@/lib/checkin/terminal-current-class"
import {
  CHECKIN_TODAY_CLASSES_ERROR_STATUS,
  createCheckinTodayClassesErrorResponse,
  createCheckinTodayClassesResponse,
} from "@/lib/nest-gateway/contracts/checkin-today-classes"
import { getNestGatewayTodayClasses } from "@/lib/nest-gateway/client"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const getTodayClassesFromNext = async (now: Date) => {
  const [activeCourses, specialClasses] = await Promise.all([
    prisma.courseCatalog.findMany({
      where: { active: true },
      orderBy: [{ createdAt: "asc" }],
      take: 100,
    }),
    prisma.specialClass.findMany({
      where: {
        status: "published",
        cancelledAt: null,
        classSession: { startsAt: getTerminalDayRange(now) },
      },
      include: { classSession: true },
      orderBy: { classSession: { startsAt: "asc" } },
      take: 100,
    }),
  ])

  return createCheckinTodayClassesResponse({ classes: buildTodayTerminalClasses(activeCourses, now, specialClasses), now })
}

/**
 * GET /api/checkin/terminal/today-classes
 *
 * Returns active CourseCatalog schedules and published Special Classes for the
 * current terminal day using the shared current-class projection.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("terminal:today-classes", ip), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  try {
    const now = new Date()
    const gatewayResult = await getNestGatewayTodayClasses({ requestId: req.headers.get("x-request-id") ?? undefined })

    if ("ok" in gatewayResult && !gatewayResult.ok) {
      return NextResponse.json(await getTodayClassesFromNext(now))
    }

    return NextResponse.json(gatewayResult)
  } catch (error) {
    console.error("Failed to fetch today's classes:", error)
    return NextResponse.json(createCheckinTodayClassesErrorResponse(), { status: CHECKIN_TODAY_CLASSES_ERROR_STATUS })
  }
}
