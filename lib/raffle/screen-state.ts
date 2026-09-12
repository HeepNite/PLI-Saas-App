import { prisma } from "@/lib/prisma"
import { resolveRaffleBaseUrl } from "@/lib/raffle/seed-plan"
import { toWinnerView, type RaffleWinnerView } from "@/lib/raffle/winner-view"

export type RaffleScreenDraw = {
  id: string
  order: number
  prizeLabel: string
  status: string
  drawAt: Date | null
  winner?: RaffleWinnerView
}

export type RaffleScreenState = {
  now: Date
  event: { slug: string; title: string; entryUrl: string; videoUrl: string }
  entryCount: number
  currentDrawId: string | null
  draws: RaffleScreenDraw[]
}

const OPEN_OR_DRAWING = new Set(["open", "drawing"])

/**
 * Shared draw-video fallback for events that never set their own
 * `RaffleEvent.videoUrl` — see the placeholder committed at this path and
 * `components/front/raffle/raffleScreenMachine.ts`'s matching client-side
 * default (used only before the first poll lands).
 */
export const DEFAULT_RAFFLE_VIDEO_URL = "/raffle/draw.mp4"

/**
 * Screen polling payload (design.md D1). `currentDrawId` is the lowest
 * `order` whose status is still `open` or `drawing`, or `null` once every
 * draw has been drawn.
 */
export const loadScreenState = async (
  db: typeof prisma,
  slug: string,
  now: Date = new Date()
): Promise<RaffleScreenState | null> => {
  const event = await db.raffleEvent.findUnique({
    where: { slug },
    include: {
      draws: { orderBy: { order: "asc" }, include: { winnerEntry: true } },
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
  }))

  const currentDraw = draws.find((draw) => OPEN_OR_DRAWING.has(draw.status))
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
  }
}
