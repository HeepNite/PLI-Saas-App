import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const LIVE_ACCOUNT = "acct_1PWRzcRtYdjwed35"
const LIVE_LOCATION = "tml_GqQ6wPY5rSAhAt"

const equalSecret = (actual: string, expected: string) => {
  const left = createHash("sha256").update(actual).digest()
  const right = createHash("sha256").update(expected).digest()
  return timingSafeEqual(left, right)
}

const respond = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(req: Request) {
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.INTERNAL_PURCHASE_LIVE_PROVISIONING_ENABLED !== "true" ||
    process.env.INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED === "true"
  ) return respond({ error: "LIVE reader provisioning is disabled" }, 503)

  const limit = consumeRateLimit({
    key: buildRateLimitKey("kiosk:terminal:live-reader-provision", getClientIp(req)),
    limit: 3,
    windowMs: 60_000,
  })
  if (!limit.ok) return respond({ error: "Too many requests" }, 429)

  const expected = process.env.INTERNAL_PURCHASE_LIVE_PROVISIONING_SECRET?.trim() || ""
  const actual = req.headers.get("authorization")?.replace(/^Bearer /, "") || ""
  if (!expected || !actual || !equalSecret(actual, expected)) return respond({ error: "Unauthorized" }, 401)

  const secret = process.env.STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY?.trim()
  if (!secret?.startsWith("rk_live_") && !secret?.startsWith("sk_live_")) {
    return respond({ error: "LIVE reader provisioning is unavailable" }, 503)
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: "2026-01-28.clover" })
    const account = await stripe.accounts.retrieve()
    if (account.id !== LIVE_ACCOUNT) return respond({ error: "LIVE merchant mismatch" }, 503)
    const token = await stripe.terminal.connectionTokens.create({ location: LIVE_LOCATION })
    if (!token.secret?.startsWith("pst_") || token.location !== LIVE_LOCATION) {
      return respond({ error: "LIVE connection token mismatch" }, 502)
    }
    return respond({ secret: token.secret, locationId: LIVE_LOCATION }, 200)
  } catch {
    return respond({ error: "Unable to create LIVE connection token" }, 502)
  }
}
