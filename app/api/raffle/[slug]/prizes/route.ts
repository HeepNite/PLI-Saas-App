import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizePrizeLabels, updateDraftPrizes, type PrizeMutationAction } from "@/lib/raffle/prizes"
import { isRaffleSlug, screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const notFound = () => NextResponse.json({ status: "not_found" }, { status: 404 })
const isTransactionConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2028" || error.code === "P2034")

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!isRaffleSlug(slug)) return notFound()

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:prizes", getClientIp(req)),
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

  const body = (await req.json().catch(() => null)) as {
    action?: unknown
    revision?: unknown
    prizes?: unknown
  } | null
  const action = body?.action
  const revision = body?.revision
  const normalized = normalizePrizeLabels(body?.prizes)
  if (
    (action !== "save" && action !== "start") ||
    typeof revision !== "string" ||
    !revision ||
    !normalized.ok
  ) {
    return NextResponse.json({ status: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        updateDraftPrizes(tx, {
          eventId: event.id,
          action: action as PrizeMutationAction,
          revision,
          labels: normalized.labels,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 }
    )

    if (result.status === "saved") return NextResponse.json(result)
    if (result.status === "started") return NextResponse.json(result)
    if (result.status === "conflict") {
      return NextResponse.json({ status: "prize_revision_conflict" }, { status: 409 })
    }
    if (result.status === "locked") {
      return NextResponse.json({ status: "prize_setup_locked" }, { status: 409 })
    }
    return notFound()
  } catch (error) {
    if (isTransactionConflict(error)) {
      return NextResponse.json({ status: "prize_revision_conflict" }, { status: 409 })
    }
    console.error("[raffle] prize authoring transaction failed", error)
    return NextResponse.json({ status: "prize_update_failed" }, { status: 503 })
  }
}
