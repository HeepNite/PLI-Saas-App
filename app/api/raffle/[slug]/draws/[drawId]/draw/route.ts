import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { isRaffleSlug, screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import { runDraw } from "@/lib/raffle/draw"
import { toWinnerView } from "@/lib/raffle/winner-view"

export const runtime = "nodejs"

const notFound = () => NextResponse.json({ status: "not_found" }, { status: 404 })

// P2028 is Prisma's interactive-transaction error: the `maxWait` connection
// wait or the `timeout` transaction lifetime elapsed. Under contention that is
// an expected outcome, not a server fault — a concurrent request holds the
// claimed row. `runDraw` is idempotent, so the tablet can safely retry.
const isTransactionTimeout = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028"

/**
 * POST /api/raffle/[slug]/draws/[drawId]/draw
 *
 * Cookie-gated (design.md D2). Runs `runDraw` inside an interactive
 * transaction (design.md D3) and maps its discriminated result to the HTTP
 * contract: drawn is 200 and identical on replay, a lost claim or zero
 * eligible entries are both 409, and a missing draw/cookie is 404.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; drawId: string }> }
) {
  const { slug, drawId } = await params
  if (!isRaffleSlug(slug)) return notFound()

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:draw", getClientIp(req)),
    limit: 20,
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

  // Cookie first; the URL key is the fallback for a screen opened straight
  // from its link, where the cookie may not have survived the navigation.
  const rawToken =
    req.cookies.get(screenCookieName(slug))?.value ?? req.nextUrl.searchParams.get("key") ?? ""
  if (!rawToken || !screenTokenMatches(rawToken, event.screenTokenHash)) return notFound()

  let result: Awaited<ReturnType<typeof runDraw>>
  try {
    result = await prisma.$transaction((tx) => runDraw(tx, { eventId: event.id, drawId, now: new Date() }), {
      maxWait: 5_000,
      timeout: 10_000,
    })
  } catch (error) {
    if (isTransactionTimeout(error)) {
      return NextResponse.json({ status: "draw_in_progress" }, { status: 409 })
    }
    console.error("[raffle] draw transaction failed", error)
    return NextResponse.json({ status: "draw_failed" }, { status: 503 })
  }

  if (result.status === "drawn") {
    return NextResponse.json({ status: "drawn", drawId, winner: toWinnerView(result.winner) })
  }
  if (result.status === "no_eligible_entries") {
    return NextResponse.json({ status: "no_eligible_entries" }, { status: 409 })
  }
  if (result.status === "in_progress") {
    return NextResponse.json({ status: "draw_in_progress" }, { status: 409 })
  }
  return notFound()
}
