import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"

export const runtime = "nodejs"

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:global-audit-log:get", limit: 60, windowMs: 60_000 },
    authorize: authorizeOwnerRequest,
  })
  if (!guard.ok) return guard.response

  // Parse query parameters
  const url = new URL(req.url)
  const staffId = url.searchParams.get("staffId")?.trim() || undefined
  const entity = url.searchParams.get("entity")?.trim() || undefined
  const from = url.searchParams.get("from")?.trim() || undefined
  const to = url.searchParams.get("to")?.trim() || undefined
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
    const validEntities = ["attendance", "payment", "package", "stats"]
    if (!validEntities.includes(entity)) {
      return NextResponse.json({ error: `Invalid entity filter. Must be one of: ${validEntities.join(", ")}` }, { status: 400 })
    }
  }

  // Validate date range if provided
  if (from || to) {
    if (from) {
      const fromDate = new Date(from)
      if (isNaN(fromDate.getTime())) {
        return NextResponse.json({ error: "Invalid 'from' date. Use ISO format (YYYY-MM-DD or ISO8601)." }, { status: 400 })
      }
    }
    if (to) {
      const toDate = new Date(to)
      if (isNaN(toDate.getTime())) {
        return NextResponse.json({ error: "Invalid 'to' date. Use ISO format (YYYY-MM-DD or ISO8601)." }, { status: 400 })
      }
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: "'from' date must be on or before 'to' date." }, { status: 400 })
    }
  }

  try {
    // Build where clause
    const where: Record<string, unknown> = {}

    if (staffId) {
      where.staffClerkId = staffId
    }

    if (entity) {
      where.entity = entity
    }

    if (from || to) {
      where.createdAt = {}
      if (from) {
        ;(where.createdAt as Record<string, unknown>).gte = new Date(from)
      }
      if (to) {
        ;(where.createdAt as Record<string, unknown>).lte = new Date(to)
      }
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
          targetUserId: true,
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
    console.error("Global audit-log error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
