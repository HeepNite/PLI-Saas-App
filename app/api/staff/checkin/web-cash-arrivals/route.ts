import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { PAYMENT_CHANNEL, SETTLEMENT_STATUS } from "@/lib/payment-constants"

export const runtime = "nodejs"

const isPrismaSchemaUnavailableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false
  const record = error as { code?: unknown; name?: unknown }
  return record.name === "PrismaClientKnownRequestError" && (record.code === "P2021" || record.code === "P2022")
}

const degradedEmptyArrivals = (reason: string) =>
  NextResponse.json([], {
    status: 200,
    headers: {
      "X-Staff-Service-Status": "degraded",
      "X-Staff-Service-Reason": reason,
    },
  })

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

    // Batch-fetch all referenced purchases in a single query (was N+1)
    const purchaseIds = arrivals
      .map((a) => {
        const meta = a.metadata && typeof a.metadata === "object" ? (a.metadata as Record<string, unknown>) : null
        return typeof meta?.purchaseId === "string" ? meta.purchaseId : null
      })
      .filter((id): id is string => Boolean(id))

    const purchases = purchaseIds.length
      ? await prisma.purchase.findMany({
          where: { id: { in: purchaseIds } },
          select: { id: true, status: true, amount: true, metadata: true },
        })
      : []
    const purchaseById = new Map(purchases.map((p) => [p.id, p]))

    const results = arrivals
      .map((attendance) => {
        const meta = attendance.metadata && typeof attendance.metadata === "object"
          ? (attendance.metadata as Record<string, unknown>)
          : null
        const purchaseId = typeof meta?.purchaseId === "string" ? meta.purchaseId : null
        if (!purchaseId) return null

        const purchase = purchaseById.get(purchaseId)
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
      .filter(Boolean)

    return NextResponse.json(results)
  } catch (error) {
    if (isPrismaSchemaUnavailableError(error)) {
      console.warn("Web cash arrivals unavailable because the database schema is not ready", error)
      return degradedEmptyArrivals("schema_unavailable")
    }
    console.error("Web cash arrivals GET failed", error)
    return NextResponse.json({ error: "Unable to fetch arrivals" }, { status: 500 })
  }
}
