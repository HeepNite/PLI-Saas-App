import { NextResponse } from "next/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { runMonthClose } from "@/lib/monthly-boundary"

export const runtime = "nodejs"

/**
 * POST /api/admin/month-close
 *
 * Administrative month closure endpoint.
 * - Requires owner or admin role
 * - Upserts MonthlyBoundary record
 * - Clears user override fields with audit trail
 * - Idempotent: re-running an already-closed month returns success with 0 cleared
 */
export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("admin:month-close:post", getClientIp(req)),
    limit: 10,
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  // Validate and parse body
  const parsed = parseMonthCloseBody(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const result = await runMonthClose({
      year: parsed.year,
      month: parsed.month,
      closedByClerkId: authResult.userId,
      notes: parsed.notes,
    })

    return NextResponse.json({
      success: true,
      boundaryId: result.boundaryId,
      overridesCleared: result.clearedOverrides,
    })
  } catch (error) {
    console.error("Month close error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Parse and validate the month-close request body.
 */
function parseMonthCloseBody(
  body: unknown
): { ok: true; year: number; month: number; notes?: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." }
  }

  const obj = body as Record<string, unknown>

  // Validate year
  const year = obj.year
  if (typeof year !== "number" || !Number.isInteger(year)) {
    return { ok: false, error: "year must be an integer." }
  }
  if (year < 2020 || year > 2099) {
    return { ok: false, error: "year must be between 2020 and 2099." }
  }

  // Validate month
  const month = obj.month
  if (typeof month !== "number" || !Number.isInteger(month)) {
    return { ok: false, error: "month must be an integer." }
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "month must be between 1 and 12." }
  }

  // Validate notes (optional)
  let notes: string | undefined
  if (obj.notes !== undefined && obj.notes !== null) {
    if (typeof obj.notes !== "string") {
      return { ok: false, error: "notes must be a string." }
    }
    notes = obj.notes.trim().slice(0, 500)
    if (notes.length === 0) {
      notes = undefined
    }
  }

  return { ok: true, year, month, notes }
}
