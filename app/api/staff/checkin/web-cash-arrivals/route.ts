import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { PAYMENT_CHANNEL, SETTLEMENT_STATUS } from "@/lib/payment-constants"

export const runtime = "nodejs"

/**
 * GET /api/staff/checkin/web-cash-arrivals?since=<ISO>
 *
 * Returns students who checked in via client-phone QR with a cash-pending
 * purchase since the given timestamp. Staff uses this for real-time alerts.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await authorizeStaffPortalSectionRequest("students")
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status, ...(authResult.retryAfterSec ? { headers: { "Retry-After": String(authResult.retryAfterSec) } } : {}) }
      )
    }

    const sinceParam = req.nextUrl.searchParams.get("since")
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000)
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: "Invalid since parameter" }, { status: 400 })
    }

    const arrivals = await prisma.attendance.findMany({
      where: {
        checkedInAt: { gt: since },
        metadata: {
          path: ["checkinSource"],
          equals: "qr_client_phone",
        },
      },
      include: {
        user: { select: { name: true, email: true } },
        session: { select: { courseSlug: true, title: true } },
      },
      orderBy: { checkedInAt: "desc" },
      take: 20,
    })

    // Filter to only cash-pending: find matching purchase
    const results = await Promise.all(
      arrivals.map(async (attendance) => {
        const meta = attendance.metadata && typeof attendance.metadata === "object"
          ? (attendance.metadata as Record<string, unknown>)
          : null
        const purchaseId = typeof meta?.purchaseId === "string" ? meta.purchaseId : null
        if (!purchaseId) return null

        const purchase = await prisma.purchase.findUnique({
          where: { id: purchaseId },
          select: { status: true, amount: true, metadata: true },
        })
        if (!purchase) return null

        const purchaseMeta = purchase.metadata && typeof purchase.metadata === "object"
          ? (purchase.metadata as Record<string, unknown>)
          : null
        const paymentChannel = typeof purchaseMeta?.paymentChannel === "string"
          ? purchaseMeta.paymentChannel
          : ""
        const settlementStatus = typeof purchaseMeta?.settlementStatus === "string"
          ? purchaseMeta.settlementStatus
          : ""

        if (paymentChannel !== PAYMENT_CHANNEL.CASH || settlementStatus !== SETTLEMENT_STATUS.PENDING) return null

        return {
          attendanceId: attendance.id,
          userName: attendance.user.name || attendance.user.email || "Unknown",
          courseTitle: attendance.session.title || attendance.session.courseSlug,
          cashAmountCents: purchase.amount,
          checkedInAt: attendance.checkedInAt.toISOString(),
        }
      })
    )

    return NextResponse.json(results.filter(Boolean))
  } catch (error) {
    console.error("Web cash arrivals GET failed", error)
    return NextResponse.json({ error: "Unable to fetch arrivals" }, { status: 500 })
  }
}
