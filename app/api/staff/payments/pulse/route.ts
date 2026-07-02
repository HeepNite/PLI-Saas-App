import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { getStaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-time"

export const runtime = "nodejs"

const isPrismaSchemaUnavailableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false
  const record = error as { code?: unknown; name?: unknown }
  return record.name === "PrismaClientKnownRequestError" && (record.code === "P2021" || record.code === "P2022")
}

const degradedPulse = (reason: string, status = 200) =>
  NextResponse.json(
    {
      status: "degraded",
      serviceStatus: reason,
      purchaseCount: 0,
      attendanceCount: 0,
      latestPurchaseAt: null,
    },
    {
      status,
      headers: { "X-Staff-Service-Status": "degraded" },
    }
  )

/**
 * GET /api/staff/payments/pulse
 *
 * Lightweight endpoint polled by the staff board to detect new activity.
 * Returns a count + latest timestamp for today's purchases and attendances.
 * The board compares with its cached values and only triggers a full refresh
 * when something changed. Costs ~2ms per call (two COUNT queries).
 */
export async function GET() {
  const authResult = await authorizeStaffPortalSectionRequest("students")
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { startOfTodayNY, endOfTodayNY, todayNY } = getStaffPaymentsTodayWindow()

  try {
    const [purchaseAgg, attendanceCount] = await Promise.all([
      prisma.purchase.aggregate({
        where: {
          OR: [
            { createdAt: { gte: startOfTodayNY, lte: endOfTodayNY } },
            { metadata: { path: ["date"], equals: todayNY } },
          ],
        },
        _count: true,
        _max: { createdAt: true },
      }),
      prisma.attendance.count({
        where: {
          checkedInAt: { gte: startOfTodayNY, lte: endOfTodayNY },
        },
      }),
    ])

    return NextResponse.json({
      status: "ok",
      purchaseCount: purchaseAgg._count,
      attendanceCount,
      latestPurchaseAt: purchaseAgg._max.createdAt?.toISOString() ?? null,
    })
  } catch (error) {
    if (isPrismaSchemaUnavailableError(error)) {
      console.warn("Staff payments pulse degraded because the database schema is not ready", error)
      return degradedPulse("schema_unavailable")
    }
    console.error("Staff payments pulse failed", error)
    return degradedPulse("database_unavailable", 503)
  }
}
