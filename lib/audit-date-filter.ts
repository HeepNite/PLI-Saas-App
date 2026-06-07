/**
 * Pure functions for audit-log date filtering.
 * Handles ISO8601 parsing and Prisma where-clause construction.
 */

type DateParseResult =
  | { ok: true; date: Date }
  | { ok: false; error: string }

type DateWhereResult =
  | Record<string, unknown>
  | { ok: false; error: string }

const DATE_ERROR = "Invalid date format. Use ISO8601 (e.g. 2026-04-01 or 2026-04-01T00:00:00.000Z)."

/**
 * Parse an ISO8601 date string. Accepts both "YYYY-MM-DD" and full ISO8601.
 * Returns a Date normalized to UTC, or an error result.
 */
export function parseAuditDate(value: string | undefined): DateParseResult {
  if (!value || value.trim() === "") {
    return { ok: false, error: DATE_ERROR }
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { ok: false, error: DATE_ERROR }
  }

  return { ok: true, date }
}

/**
 * Build a Prisma where clause for createdAt date filtering.
 * Returns an empty object if no dates provided.
 * Returns { ok: false, error } if validation fails.
 */
export function buildDateWhereClause(
  fromDate: string | undefined,
  toDate: string | undefined
): DateWhereResult {
  if (!fromDate && !toDate) {
    return {}
  }

  let fromDateObj: Date | undefined
  let toDateObj: Date | undefined

  if (fromDate) {
    const parsed = parseAuditDate(fromDate)
    if (!parsed.ok) return parsed
    fromDateObj = parsed.date
  }

  if (toDate) {
    const parsed = parseAuditDate(toDate)
    if (!parsed.ok) return parsed
    toDateObj = parsed.date
  }

  // Validate range ordering when both present
  if (fromDateObj && toDateObj && fromDateObj > toDateObj) {
    return { ok: false, error: "'fromDate' must be on or before 'toDate'." }
  }

  const createdAt: Record<string, Date> = {}
  if (fromDateObj) createdAt.gte = fromDateObj
  if (toDateObj) createdAt.lte = toDateObj

  return { createdAt }
}
