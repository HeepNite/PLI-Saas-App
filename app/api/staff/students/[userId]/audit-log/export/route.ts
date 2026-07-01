import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { buildDateWhereClause } from "@/lib/audit-date-filter"

export const runtime = "nodejs"

const MAX_EXPORT_ROWS = 10_000
const CSV_HEADERS = "Date,Staff,Entity,Field,Before,After,Reason"

/**
 * Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines.
 * Double any existing quotes per RFC 4180.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Format a Date as ISO8601 for CSV output.
 */
function formatDate(date: Date): string {
  return date.toISOString()
}

/**
 * Convert an audit entry to a CSV row string.
 */
function entryToCsvRow(entry: {
  createdAt: Date
  staffName: string | null
  entity: string
  field: string
  valueBefore: unknown
  valueAfter: unknown
  reason: string
}): string {
  return [
    formatDate(entry.createdAt),
    csvEscape(entry.staffName),
    csvEscape(entry.entity),
    csvEscape(entry.field),
    csvEscape(entry.valueBefore),
    csvEscape(entry.valueAfter),
    csvEscape(entry.reason),
  ].join(",")
}

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:audit-log:export", limit: 30, windowMs: 60_000 },
    authorize: () => authorizeOwnerOrAdminRequest(),
  })
  if (!guard.ok) return guard.response

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  // Parse query parameters
  const url = new URL(req.url)
  const fromDate = url.searchParams.get("fromDate")?.trim() || undefined
  const toDate = url.searchParams.get("toDate")?.trim() || undefined

  // Validate and build date filter
  const dateWhere = buildDateWhereClause(fromDate, toDate)
  if ("ok" in dateWhere && !dateWhere.ok) {
    return NextResponse.json({ error: dateWhere.error }, { status: 400 })
  }

  try {
    const where: Record<string, unknown> = {
      targetUserId: userId,
      ...dateWhere,
    }

    // Fetch all matching rows without pagination, capped at MAX_EXPORT_ROWS + 1 to detect overflow
    const entries = await prisma.studentDataAudit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS + 1,
      select: {
        createdAt: true,
        staffName: true,
        entity: true,
        field: true,
        valueBefore: true,
        valueAfter: true,
        reason: true,
      },
    })

    const capReached = entries.length > MAX_EXPORT_ROWS
    const cappedEntries = capReached ? entries.slice(0, MAX_EXPORT_ROWS) : entries
    const rowCount = cappedEntries.length

    // Build CSV string
    const rows = cappedEntries.map(entryToCsvRow)
    const csv = [CSV_HEADERS, ...rows].join("\n") + "\n"

    const headers = new Headers({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-log-${userId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Row-Count": String(rowCount),
    })

    if (capReached) {
      headers.set("X-Row-Cap-Reached", "true")
    }

    return new NextResponse(csv, { status: 200, headers })
  } catch (error) {
    console.error("Audit-log export error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
