import { prisma } from "@/lib/prisma"
import { computePrizeDraftRevision } from "@/lib/raffle/prizes"
import { resolveRaffleBaseUrl } from "@/lib/raffle/seed-plan"
import { toWinnerView, type RaffleWinnerView } from "@/lib/raffle/winner-view"

export type RaffleScreenDraw = {
  id: string
  order: number
  prizeLabel: string
  status: string
  drawAt: Date | null
  winner?: RaffleWinnerView
  pendingAttempt?: { id: string; winner: RaffleWinnerView }
}

export type RaffleScreenState = {
  now: Date
  event: { slug: string; title: string; entryUrl: string; videoUrl: string }
  entryCount: number
  currentDrawId: string | null
  draws: RaffleScreenDraw[]
  prizeSetup?: {
    editable: true
    revision: string
    prizes: Array<{ id: string; label: string }>
  }
}

const CURRENT_DRAW_STATUSES = new Set(["open", "drawing", "awaiting_confirmation"])

/**
 * Shared draw-video fallback for events that never set their own
 * `RaffleEvent.videoUrl` — see the placeholder committed at this path and
 * `components/front/raffle/raffleScreenMachine.ts`'s matching client-side
 * default (used only before the first poll lands).
 */
export const DEFAULT_RAFFLE_VIDEO_URL = "/raffle/draw.mp4"

/**
 * Screen polling payload (design.md D1). `currentDrawId` is the lowest
 * `order` whose status is still `open`, `drawing`, or awaiting attendance
 * confirmation, or `null` once every draw has been confirmed.
 */
export const loadScreenState = async (
  db: typeof prisma,
  slug: string,
  now: Date = new Date()
): Promise<RaffleScreenState | null> => {
  const event = await db.raffleEvent.findUnique({
    where: { slug },
    include: {
      draws: {
        orderBy: { order: "asc" },
        include: {
          winnerEntry: true,
          attempts: {
            where: { status: "pending" },
            include: { entry: true },
            orderBy: { selectedAt: "desc" },
            take: 1,
          },
          _count: { select: { attempts: true } },
        },
      },
      _count: { select: { entries: true } },
    },
  })
  if (!event) return null

  const draws: RaffleScreenDraw[] = event.draws.map((draw) => ({
    id: draw.id,
    order: draw.order,
    prizeLabel: draw.prizeLabel,
    status: draw.status,
    drawAt: draw.drawAt,
    ...(draw.winnerEntry ? { winner: toWinnerView(draw.winnerEntry) } : {}),
    ...(draw.attempts[0]
      ? { pendingAttempt: { id: draw.attempts[0].id, winner: toWinnerView(draw.attempts[0].entry) } }
      : {}),
  }))

  const currentDraw = draws.find((draw) => CURRENT_DRAW_STATUSES.has(draw.status))
  const allDraft =
    event.draws.length > 0 &&
    event.draws.every(
      (draw) => draw.status === "draft" && draw.winnerEntryId === null && draw._count.attempts === 0
    )
  const prizeSetup = allDraft
    ? {
        editable: true as const,
        revision: computePrizeDraftRevision(
          event.draws.map((draw) => ({
            id: draw.id,
            order: draw.order,
            prizeLabel: draw.prizeLabel,
            drawAt: draw.drawAt,
            status: draw.status,
            winnerEntryId: draw.winnerEntryId,
            updatedAt: draw.updatedAt,
            attempts: [],
          }))
        ),
        prizes: event.draws.map((draw) => ({ id: draw.id, label: draw.prizeLabel })),
      }
    : undefined
  const entryUrl = `${resolveRaffleBaseUrl({
    siteUrlEnv: process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrlEnv: process.env.VERCEL_URL,
  })}/raffle/${event.slug}`

  return {
    now,
    event: { slug: event.slug, title: event.title, entryUrl, videoUrl: event.videoUrl ?? DEFAULT_RAFFLE_VIDEO_URL },
    entryCount: event._count.entries,
    currentDrawId: currentDraw?.id ?? null,
    draws,
    ...(prizeSetup ? { prizeSetup } : {}),
  }
}
