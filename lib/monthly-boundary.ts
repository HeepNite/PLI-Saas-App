import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"

const NY_TIMEZONE = "America/New_York"

const SPANISH_MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

/**
 * Get the start of a given day in America/New_York as a UTC Date.
 * Dynamically handles EDT (UTC-4) and EST (UTC-5).
 * Mirrors the pattern from getStartOfDayNY in class-schedule.ts.
 */
function getStartOfDayNY(dateStr: string): Date {
  // Use noon UTC as reference point (safe from DST transition edges)
  const ref = new Date(`${dateStr}T12:00:00Z`)
  // Determine what hour it is in NY when it's noon UTC
  const nyHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(ref)
  const nyHour = parseInt(nyHourStr, 10)
  // At noon UTC (12:00), NY shows 8 (EDT=UTC-4) or 7 (EST=UTC-5)
  const offsetHours = 12 - nyHour
  // Midnight NY = offsetHours:00:00 UTC on that date
  return new Date(`${dateStr}T${String(offsetHours).padStart(2, "0")}:00:00Z`)
}

/**
 * Returns the current year and month in America/New_York timezone.
 */
function getCurrentYearMonthNY(now: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now)
  const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10)
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10)
  return { year, month }
}

/**
 * Compute month boundaries in America/New_York timezone.
 *
 * Returns the start of the 1st of the month (00:00:00 NY) and
 * the start of the 1st of the NEXT month (00:00:00 NY, exclusive upper bound).
 *
 * Handles DST transitions correctly (March spring-forward, November fall-back).
 */
export function getMonthBoundariesNY(
  year: number,
  month: number
): { start: Date; end: Date } {
  // First day of the target month
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
  const start = getStartOfDayNY(firstDay)

  // First day of the next month
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextFirstDay = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  const end = getStartOfDayNY(nextFirstDay)

  return { start, end }
}

/**
 * Get the current month's boundaries using America/New_York timezone.
 */
export function getCurrentMonthBoundariesNY(
  now: Date = new Date()
): { start: Date; end: Date; year: number; month: number } {
  const { year, month } = getCurrentYearMonthNY(now)
  const { start, end } = getMonthBoundariesNY(year, month)
  return { start, end, year, month }
}

/**
 * Format a date as "Mes YYYY" in Spanish (e.g., "Mayo 2026").
 */
function formatMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: NY_TIMEZONE,
    year: "numeric",
    month: "long",
  }).formatToParts(date)
  const monthName = parts.find((p) => p.type === "month")?.value ?? ""
  const year = parts.find((p) => p.type === "year")?.value ?? ""
  // Capitalize month name (Intl returns lowercase in some locales)
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  return `${capitalized} ${year}`
}

/**
 * Format a year/month pair as "Mes YYYY" in Spanish (e.g., "Mayo 2026").
 */
function formatMonthKeyFromYM(year: number, month: number): string {
  // Use a safe date (15th of the month) to avoid any DST edge issues
  const date = new Date(year, month - 1, 15, 12, 0, 0, 0)
  const monthName = SPANISH_MONTHS[month - 1]
  return `${monthName} ${year}`
}

/**
 * Close a month: upsert MonthlyBoundary and clear user overrides.
 *
 * Idempotent: if the month is already closed (closedAt not null),
 * returns the existing boundary without re-clearing overrides.
 *
 * Uses prisma.$transaction for atomicity.
 * Creates one StudentDataAudit row per user whose override was cleared.
 */
export async function runMonthClose(params: {
  year: number
  month: number
  closedByClerkId: string
  notes?: string
}): Promise<{ boundaryId: string; clearedOverrides: number }> {
  const { year, month, closedByClerkId, notes } = params
  const now = new Date()
  const monthKey = `${year}-${String(month).padStart(2, "0")}`

  const result = await prisma.$transaction(async (tx) => {
    // Upsert the MonthlyBoundary
    const boundary = await tx.monthlyBoundary.upsert({
      where: { year_month: { year, month } },
      create: {
        year,
        month,
        closedAt: now,
        closedByClerkId,
        notes: notes ?? null,
      },
      update: {
        closedAt: now,
        closedByClerkId,
        notes: notes ?? null,
      },
    })

    // If already closed, return early (idempotent — no re-clear)
    if (boundary.closedAt !== null) {
      return { boundaryId: boundary.id, clearedOverrides: 0 }
    }

    let clearedCount = 0

    // Find users with completedClassesOverride and clear them with audit
    const usersWithCompletedOverride = await tx.user.findMany({
      where: { completedClassesOverride: { not: null } },
      select: { id: true, completedClassesOverride: true },
    })

    for (const user of usersWithCompletedOverride) {
      await tx.user.update({
        where: { id: user.id },
        data: { completedClassesOverride: null },
      })
      await writeStudentDataAudit(
        {
          targetUserId: user.id,
          staffClerkId: closedByClerkId,
          entity: "stats",
          field: "completedClassesOverride",
          valueBefore: user.completedClassesOverride,
          valueAfter: null,
          reason: `Monthly close ${monthKey}: override cleared`,
        },
        tx
      )
      clearedCount++
    }

    // Find users with packageClassesUsedOverride and clear them with audit
    const usersWithPackageOverride = await tx.user.findMany({
      where: { packageClassesUsedOverride: { not: null } },
      select: { id: true, packageClassesUsedOverride: true },
    })

    for (const user of usersWithPackageOverride) {
      await tx.user.update({
        where: { id: user.id },
        data: { packageClassesUsedOverride: null },
      })
      await writeStudentDataAudit(
        {
          targetUserId: user.id,
          staffClerkId: closedByClerkId,
          entity: "stats",
          field: "packageClassesUsedOverride",
          valueBefore: user.packageClassesUsedOverride,
          valueAfter: null,
          reason: `Monthly close ${monthKey}: override cleared`,
        },
        tx
      )
      clearedCount++
    }

    return { boundaryId: boundary.id, clearedOverrides: clearedCount }
  })

  return result
}
