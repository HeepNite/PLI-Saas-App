import { NextRequest, NextResponse } from "next/server"
import { buildTodayTerminalClasses } from "@/lib/checkin/terminal-current-class"
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
  const activeCourses = await prisma.courseCatalog.findMany({
    where: { active: true },
    orderBy: [{ createdAt: "asc" }],
    take: 100,
  })

  return createCheckinTodayClassesResponse({ classes: buildTodayTerminalClasses(activeCourses, now), now })
}

/**
 * GET /api/checkin/terminal/today-classes
 *
 * Returns all active CourseCatalog entries that have classes scheduled for today
 * using the same terminal current-class source used by staff fast actions.
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
