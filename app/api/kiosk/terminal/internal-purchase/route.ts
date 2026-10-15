import { NextResponse } from "next/server"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseInternalPurchaseRequest } from "@/lib/stripe/internal-purchase"
import {
  InternalPurchaseError, isInternalPurchaseEnabled, prepareInternalPurchase,
} from "@/apps/backend/src/terminal/internal-purchase.service"

export const runtime = "nodejs"

const respond = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })

export async function POST(req: Request) {
  if (!isInternalPurchaseEnabled()) return respond({ error: "Internal purchase preparation is disabled" }, 503)
  const limit = consumeRateLimit({
    key: buildRateLimitKey("kiosk:terminal:internal-purchase", getClientIp(req)),
    limit: 30, windowMs: 60_000,
  })
  if (!limit.ok) {
    return respond({ error: "Too many requests. Please try again in a moment." }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    })
  }
  try {
    const auth = await authorizeStaffTerminalSession({ touchLastSeen: false })
    if (!auth.ok) return respond({ error: "Terminal session required for kiosk checkout." }, 401)
    const body: unknown = await req.json().catch(() => null)
    const input = parseInternalPurchaseRequest(body)
    if (!input || new URL(req.url).search) {
      return respond({ error: "Invalid internal-purchase payload" }, 400)
    }
    const result = await prepareInternalPurchase(input, {
      sessionId: auth.sessionId,
      terminalId: auth.terminal.id,
      terminalSlug: auth.terminal.slug,
      terminalName: auth.terminal.name,
      terminalLocation: auth.terminal.location,
    })
    return respond(result)
  } catch (error) {
    // Provider exceptions can contain credentials and token secrets; never return or log them.
    if (error instanceof InternalPurchaseError) return respond({ error: error.message }, error.status)
    return respond({ error: "Unable to prepare internal purchase" }, 502)
  }
}
