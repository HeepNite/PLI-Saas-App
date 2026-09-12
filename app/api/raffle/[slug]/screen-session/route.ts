import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  isRaffleSlug,
  screenCookieName,
  screenTokenMatches,
  SCREEN_COOKIE_MAX_AGE_SEC,
} from "@/lib/raffle/screen-token"

export const runtime = "nodejs"

const notFound = () => NextResponse.json({ status: "not_found" }, { status: 404 })

const rateLimited = (retryAfterSec: number) =>
  NextResponse.json(
    { status: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  )

/**
 * GET /api/raffle/[slug]/screen-session?key=<raw token>
 *
 * Exchanges a raw screen token for an httpOnly cookie (design.md D2). A
 * server component may not set cookies during render, so this route exists
 * purely to perform that exchange before redirecting back to the clean
 * screen path.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isRaffleSlug(slug)) return notFound()

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:draw", getClientIp(req)),
    limit: 20,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) return rateLimited(rateLimit.retryAfterSec)

  const url = new URL(req.url)
  const key = url.searchParams.get("key")
  if (!key) return notFound()

  const event = await prisma.raffleEvent.findUnique({ where: { slug } })
  if (!event) return notFound()

  if (!screenTokenMatches(key, event.screenTokenHash)) return notFound()

  const screenUrl = new URL(`/staff/raffle/${slug}/screen`, url)
  const response = NextResponse.redirect(screenUrl, 302)
  response.cookies.set(screenCookieName(slug), key, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SCREEN_COOKIE_MAX_AGE_SEC,
  })
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set("Cache-Control", "no-store")
  return response
}
