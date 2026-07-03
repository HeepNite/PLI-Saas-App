import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { getMonthBoundariesNY } from "@/lib/monthly-boundary"

export const runtime = "nodejs"

const MAX_EXPORT_ROWS = 10_000

const CSV_HEADERS =
  "Student Name,Email,Phone,Attendances,Completed Classes,Amount Paid,Package Name,Package Credits Remaining,Points Balance"

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
 * Parse and validate query parameters for the monthly report.
 */
function parseQueryParams(
  url: URL
): { ok: true; year: number; month: number } | { ok: false; error: string } {
  const yearStr = url.searchParams.get("year")
  const monthStr = url.searchParams.get("month")

  if (!yearStr || !monthStr) {
    return { ok: false, error: "Missing required query parameters: year and month." }
  }

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  if (Number.isNaN(year) || !Number.isInteger(year)) {
    return { ok: false, error: "year must be a valid integer." }
  }
  if (year < 2020 || year > 2099) {
    return { ok: false, error: "year must be between 2020 and 2099." }
  }

  if (Number.isNaN(month) || !Number.isInteger(month)) {
    return { ok: false, error: "month must be a valid integer." }
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "month must be between 1 and 12." }
  }

  return { ok: true, year, month }
}

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:reports:monthly:get", limit: 30, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalSectionRequest("reports"),
  })
  if (!guard.ok) return guard.response

  const url = new URL(req.url)
  const parsed = parseQueryParams(url)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { year, month } = parsed
  const { start, end } = getMonthBoundariesNY(year, month)

  try {
    // 1. Get all attendances in the month
    const attendances = await prisma.attendance.findMany({
      where: {
        checkedInAt: { gte: start, lt: end },
      },
      select: {
        userId: true,
        id: true,
      },
    })

    // 2. Get all purchases in the month (metadata.date OR createdAt)
    const monthStartStr = `${year}-${String(month).padStart(2, "0")}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const monthEndStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

    const purchases = await prisma.purchase.findMany({
      where: {
        OR: [
          { metadata: { path: ["date"], gte: monthStartStr, lt: monthEndStr } },
          { createdAt: { gte: start, lt: end } },
        ],
      },
      select: {
        userId: true,
        amount: true,
      },
    })

    // 3. Aggregate attendance count per user
    const attendanceCountByUser = new Map<string, number>()
    for (const att of attendances) {
      attendanceCountByUser.set(att.userId, (attendanceCountByUser.get(att.userId) || 0) + 1)
    }

    // 4. Aggregate purchase amount per user
    const amountPaidByUser = new Map<string, number>()
    for (const p of purchases) {
      amountPaidByUser.set(p.userId, (amountPaidByUser.get(p.userId) || 0) + p.amount)
    }

    // 5. Collect all unique user IDs with activity this month
    const userIds = new Set<string>()
    for (const att of attendances) userIds.add(att.userId)
    for (const p of purchases) userIds.add(p.userId)

    // If no activity, return empty CSV
    if (userIds.size === 0) {
      const csv = CSV_HEADERS + "\n"
      const monthLabel = String(month).padStart(2, "0")
      const headers = new Headers({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="monthly-report-${year}-${monthLabel}.csv"`,
      })
      return new NextResponse(csv, { status: 200, headers })
    }

    const userIdList = [...userIds]

    // 6. Fetch user details, points, and active packages in parallel
    const [users, pointsGrouped, activePackages] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIdList } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),
      prisma.pointsLedger.groupBy({
        by: ["userId"],
        where: { userId: { in: userIdList } },
        _sum: { points: true },
      }),
      prisma.packagePurchase.findMany({
        where: {
          userId: { in: userIdList },
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          userId: true,
          packageLabel: true,
          remainingCredits: true,
          isUnlimited: true,
        },
        orderBy: { purchasedAt: "desc" },
      }),
    ])

    // Build lookup maps
    const userById = new Map(users.map((u) => [u.id, u]))
    const pointsByUser = new Map<string, number>()
    for (const row of pointsGrouped) {
      pointsByUser.set(row.userId, row._sum.points || 0)
    }

    // Get the most recent active package per user
    const packageByUser = new Map<string, { label: string | null; remaining: string }>()
    for (const pkg of activePackages) {
      if (!packageByUser.has(pkg.userId)) {
        packageByUser.set(pkg.userId, {
          label: pkg.packageLabel || null,
          remaining: pkg.isUnlimited ? "Unlimited" : String(pkg.remainingCredits ?? 0),
        })
      }
    }

    // 7. Build CSV rows
    const rows: string[] = []
    for (const userId of userIdList) {
      const user = userById.get(userId)
      if (!user) continue

      const attendances = attendanceCountByUser.get(userId) || 0
      const amountPaid = amountPaidByUser.get(userId) || 0
      const points = pointsByUser.get(userId) || 0
      const pkg = packageByUser.get(userId)

      // Completed classes = attendances for this month (simplified — matches board logic)
      const completedClasses = attendances

      rows.push(
        [
          csvEscape(user.name),
          csvEscape(user.email),
          csvEscape(user.phone),
          String(attendances),
          String(completedClasses),
          String(amountPaid),
          csvEscape(pkg?.label ?? ""),
          csvEscape(pkg?.remaining ?? ""),
          String(points),
        ].join(",")
      )

      // Cap at MAX_EXPORT_ROWS
      if (rows.length >= MAX_EXPORT_ROWS) break
    }

    const csv = [CSV_HEADERS, ...rows].join("\n") + "\n"

    const monthLabel = String(month).padStart(2, "0")
    const headers = new Headers({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="monthly-report-${year}-${monthLabel}.csv"`,
      "X-Row-Count": String(rows.length),
    })

    return new NextResponse(csv, { status: 200, headers })
  } catch (error) {
    console.error("Monthly report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
