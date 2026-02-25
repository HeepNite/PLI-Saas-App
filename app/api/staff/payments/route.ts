import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

type SettlementStatus = "pending" | "paid"

const COMPLETED_PAYMENT_STATUSES = new Set(["succeeded", "paid", "completed"])

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const normalizeSettlementStatus = (value: unknown): SettlementStatus => {
  if (typeof value !== "string") return "pending"
  return value.toLowerCase() === "paid" ? "paid" : "pending"
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:get", getClientIp(req)),
    limit: 90,
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

  const url = new URL(req.url)
  const query = url.searchParams.get("q")?.trim() || ""
  const settlementFilter = url.searchParams.get("settlement")?.trim().toLowerCase() || "all"

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
          { courseTitle: { contains: query, mode: "insensitive" as const } },
          { courseSlug: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const mapped = purchases.map((purchase) => {
    const metadata = asObject(purchase.metadata)
    const settlementStatus = normalizeSettlementStatus(metadata.settlementStatus)
    const settledAtRaw = metadata.settledAt
    const settledAt =
      typeof settledAtRaw === "string" || typeof settledAtRaw === "number" ? new Date(settledAtRaw).toISOString() : null
    return {
      id: purchase.id,
      userId: purchase.userId,
      courseSlug: purchase.courseSlug,
      courseTitle: purchase.courseTitle || purchase.courseSlug,
      customerName: purchase.name || "—",
      customerEmail: purchase.email || "—",
      customerPhone: purchase.phone || "—",
      amount: purchase.amount,
      currency: purchase.currency,
      paymentStatus: purchase.status,
      settlementStatus,
      settlementNote: typeof metadata.settlementNote === "string" ? metadata.settlementNote : "",
      settledAt,
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
    }
  })

  const filtered = settlementFilter === "all" ? mapped : mapped.filter((item) => item.settlementStatus === settlementFilter)

  const summary = {
    totalItems: filtered.length,
    totalCollected: filtered
      .filter((item) => COMPLETED_PAYMENT_STATUSES.has(item.paymentStatus.toLowerCase()))
      .reduce((sum, item) => sum + item.amount, 0),
    pendingSettlement: filtered.filter((item) => item.settlementStatus === "pending").length,
    paidSettlement: filtered.filter((item) => item.settlementStatus === "paid").length,
  }

  return NextResponse.json({ items: filtered, summary })
}
