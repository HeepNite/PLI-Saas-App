import { NextResponse } from "next/server"
import {
  createKioskQrCashGrant,
  KIOSK_QR_CASH_GRANT_TTL_SECONDS,
} from "@/lib/checkin/kiosk-qr-cash-grant"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"

export const runtime = "nodejs"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const isValidDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkin:qr:cash-grant", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const terminalAuth = await authorizeStaffTerminalSession({ touchLastSeen: false })
  if (!terminalAuth.ok) {
    return NextResponse.json({ error: "Authorized terminal session required." }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const courseSlug = typeof body?.courseSlug === "string" ? body.courseSlug.trim().toLowerCase() : ""
  const date = typeof body?.date === "string" ? body.date.trim() : ""
  const time = typeof body?.time === "string" ? body.time.trim() : ""
  if (!SLUG_PATTERN.test(courseSlug) || !isValidDate(date) || !TIME_PATTERN.test(time)) {
    return NextResponse.json({ error: "Invalid class context." }, { status: 400 })
  }

  const now = new Date()
  const grant = createKioskQrCashGrant({
    terminalId: terminalAuth.terminal.id,
    courseSlug,
    date,
    time,
  }, { now })

  const expiresAtSeconds = Math.floor(now.getTime() / 1000) + KIOSK_QR_CASH_GRANT_TTL_SECONDS
  return NextResponse.json({
    grant,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  })
}
