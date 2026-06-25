import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { getStaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-time"

export const runtime = "nodejs"

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
    purchaseCount: purchaseAgg._count,
    attendanceCount,
    latestPurchaseAt: purchaseAgg._max.createdAt?.toISOString() ?? null,
  })
}
