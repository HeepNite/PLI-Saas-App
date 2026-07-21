import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getNestGatewayTerminalConnectionToken } from "@/lib/nest-gateway/client"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"

export const runtime = "nodejs"

const secret = process.env.STRIPE_SECRET_KEY
const stripe = secret
  ? new Stripe(secret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const sanitizeStripeError = (error: unknown, requestId?: string) => {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: "Unknown Stripe error",
      requestId: requestId || undefined,
    }
  }

  const stripeError = error as Error & {
    code?: string
    requestId?: string
    statusCode?: number
  }

  return {
    name: stripeError.name,
    message: stripeError.message,
    code: stripeError.code,
    status: stripeError.statusCode,
    requestId: requestId || stripeError.requestId || undefined,
  }
}

const createLocalConnectionToken = async (requestId?: string) => {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  try {
    const token = await stripe.terminal.connectionTokens.create()
    return NextResponse.json({ secret: token.secret })
  } catch (error) {
    console.error("Terminal connection token error", sanitizeStripeError(error, requestId))
    return NextResponse.json({ error: "Unable to create terminal connection token" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id")?.trim() || undefined
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("kiosk:terminal:connection-token", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return NextResponse.json({ error: "Terminal session required for kiosk checkout." }, { status: 401 })
  }

  const gatewayResult = await getNestGatewayTerminalConnectionToken({
    payload: {
      sessionId: terminalAuth.sessionId,
      terminalId: terminalAuth.terminal.id,
      terminalSlug: terminalAuth.terminal.slug,
      terminalName: terminalAuth.terminal.name,
      terminalLocation: terminalAuth.terminal.location,
    },
    requestId,
  })

  if ("ok" in gatewayResult && !gatewayResult.ok) {
    return createLocalConnectionToken(requestId)
  }

  return NextResponse.json(gatewayResult)
}
