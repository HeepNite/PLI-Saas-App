import { NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { PURCHASE_STATUS } from "@/lib/payment-constants"

const secret = process.env.STRIPE_SECRET_KEY
const stripe = secret
  ? new Stripe(secret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const DURABLE_COMPLETE_PURCHASE_STATUSES: Set<string> = new Set([PURCHASE_STATUS.PAID, PURCHASE_STATUS.SUCCEEDED, PURCHASE_STATUS.COMPLETED])

const isStripeNotFoundError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "resource_missing"
  )

export async function GET(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return NextResponse.json({ error: "Terminal session required for kiosk checkout status." }, { status: 401 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey(`checkout:session:status:${terminalAuth.sessionId}`, getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
  }

  try {
    const [session, purchase] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      prisma.purchase.findUnique({ where: { stripeCheckoutSessionId: sessionId } }),
    ])

    if (purchase && DURABLE_COMPLETE_PURCHASE_STATUSES.has((purchase.status || "").toLowerCase())) {
      return NextResponse.json({
        status: "complete",
        sessionId,
        purchaseId: purchase.id,
        paymentStatus: purchase.status,
      })
    }

    if (session.status === "expired") {
      return NextResponse.json({ status: "expired", sessionId })
    }

    if (session.status === "complete" && session.payment_status === "paid") {
      return NextResponse.json({
        status: "complete",
        sessionId,
        purchaseId: null,
        paymentStatus: session.payment_status,
        awaitingWebhook: true,
      })
    }

    if (session.status === "complete") {
      return NextResponse.json({
        status: "open",
        sessionId,
        awaitingWebhook: true,
      })
    }

    return NextResponse.json({ status: "open", sessionId })
  } catch (error) {
    if (isStripeNotFoundError(error)) {
      return NextResponse.json({ status: "not_found", sessionId }, { status: 404 })
    }

    console.error("Stripe checkout session status error", error)
    return NextResponse.json({ error: "Unable to retrieve checkout session status" }, { status: 500 })
  }
}
