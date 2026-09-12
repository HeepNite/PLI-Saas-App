import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { isRaffleSlug, screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import { loadScreenState } from "@/lib/raffle/screen-state"

export const runtime = "nodejs"

const notFound = () => NextResponse.json({ status: "not_found" }, { status: 404 })

/**
 * GET /api/raffle/[slug]/screen-state
 *
 * Polled by the tablet screen every ~5s (design.md D1). Requires the screen
 * cookie set by the screen-session exchange — the URL key is never accepted
 * here, only the cookie.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isRaffleSlug(slug)) return notFound()

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:screen-state", getClientIp(req)),
    limit: 240,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const event = await prisma.raffleEvent.findUnique({ where: { slug } })
  if (!event) return notFound()

  const rawToken = req.cookies.get(screenCookieName(slug))?.value ?? ""
  if (!rawToken || !screenTokenMatches(rawToken, event.screenTokenHash)) return notFound()

  const state = await loadScreenState(prisma, slug)
  if (!state) return notFound()

  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } })
}
