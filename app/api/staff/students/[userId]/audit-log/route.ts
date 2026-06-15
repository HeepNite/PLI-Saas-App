import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { buildDateWhereClause } from "@/lib/audit-date-filter"

export const runtime = "nodejs"

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:audit-log:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  // Parse query parameters
  const url = new URL(req.url)
  const entity = url.searchParams.get("entity")?.trim() || undefined
  const fromDate = url.searchParams.get("fromDate")?.trim() || undefined
  const toDate = url.searchParams.get("toDate")?.trim() || undefined
  const pageParam = url.searchParams.get("page")?.trim() || "1"
  const pageSizeParam = url.searchParams.get("pageSize")?.trim() || String(DEFAULT_PAGE_SIZE)

  const page = parseInt(pageParam, 10)
  const pageSize = parseInt(pageSizeParam, 10)

  if (isNaN(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page parameter." }, { status: 400 })
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return NextResponse.json({ error: `Invalid pageSize parameter. Must be between 1 and ${MAX_PAGE_SIZE}.` }, { status: 400 })
  }

  // Validate entity filter if provided
  if (entity) {
    const validEntities = ["attendance", "payment", "package", "stats", "profile"]
    if (!validEntities.includes(entity)) {
      return NextResponse.json({ error: `Invalid entity filter. Must be one of: ${validEntities.join(", ")}` }, { status: 400 })
    }
  }

  // Validate and build date filter
  const dateWhere = buildDateWhereClause(fromDate, toDate)
  if ("ok" in dateWhere && !dateWhere.ok) {
    return NextResponse.json({ error: dateWhere.error }, { status: 400 })
  }

  try {
    const where: Record<string, unknown> = {
      targetUserId: userId,
      ...(entity ? { entity } : {}),
      ...dateWhere,
    }

    const [total, entries] = await Promise.all([
      prisma.studentDataAudit.count({ where }),
      prisma.studentDataAudit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          staffClerkId: true,
          staffName: true,
          entity: true,
          entityId: true,
          field: true,
          valueBefore: true,
          valueAfter: true,
          reason: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ])

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      ok: true,
      data: {
        entries,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    console.error("Student audit-log error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
