import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"

export const runtime = "nodejs"

const ALLOWED_ROLES = new Set(["owner", "admin", "front_desk"])

/**
 * GET /api/staff/checkin/web-cash-arrivals?since=<ISO>
 *
 * Returns students who checked in via client-phone QR with a cash-pending
 * purchase since the given timestamp. Staff uses this for real-time alerts.
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("staff:checkin:web-cash-arrivals:get", getClientIp(req)),
      limit: 60,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const role = extractStaffRoleFromUserMetadata(clerkUser)
    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

        if (paymentChannel !== "cash" || settlementStatus !== "pending") return null

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
