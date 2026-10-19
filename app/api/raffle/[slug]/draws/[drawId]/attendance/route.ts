import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveDrawAttendance, type DrawAttendanceAction } from "@/lib/raffle/attendance"
import { toWinnerView } from "@/lib/raffle/winner-view"
import { isRaffleSlug, screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const notFound = () => NextResponse.json({ status: "not_found" }, { status: 404 })
const isTransactionTimeout = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; drawId: string }> }
) {
  const { slug, drawId } = await params
  if (!isRaffleSlug(slug)) return notFound()

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:attendance", getClientIp(req)),
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
  const rawToken = req.cookies.get(screenCookieName(slug))?.value ?? ""
  if (!rawToken || !screenTokenMatches(rawToken, event.screenTokenHash)) return notFound()

  const body = (await req.json().catch(() => null)) as { attemptId?: unknown; action?: unknown } | null
  const action = body?.action
  const attemptId = body?.attemptId
  if (
    typeof attemptId !== "string" ||
    !attemptId ||
    (action !== "showed_up" && action !== "draw_again")
  ) {
    return NextResponse.json({ status: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        resolveDrawAttendance(tx, {
          eventId: event.id,
          drawId,
          attemptId,
          action: action as DrawAttendanceAction,
          now: new Date(),
        }),
      { maxWait: 5_000, timeout: 10_000 }
    )

    if (result.status === "confirmed") return NextResponse.json({ status: "confirmed", drawId, attemptId })
    if (result.status === "redrawn") {
      return NextResponse.json({
        status: "drawn",
        drawId,
        attemptId: result.attemptId,
        winner: toWinnerView(result.winner),
      })
    }
    if (result.status === "no_eligible_entries") {
      return NextResponse.json({ status: "no_eligible_entries" }, { status: 409 })
    }
    if (result.status === "conflict") {
      return NextResponse.json({ status: "attendance_conflict" }, { status: 409 })
    }
    return notFound()
  } catch (error) {
    if (isTransactionTimeout(error)) {
      return NextResponse.json({ status: "attendance_conflict" }, { status: 409 })
    }
    console.error("[raffle] attendance transaction failed", error)
    return NextResponse.json({ status: "attendance_failed" }, { status: 503 })
  }
}
