import { randomInt } from "node:crypto"
import type { Prisma } from "@prisma/client"

/**
 * Draw execution domain (design.md D3, D4). Takes the transaction client as
 * its first parameter — the same shape as `reservePackageCreditForAttendanceTx`
 * in `lib/packages.ts` — so the whole concurrency contract is testable with a
 * mocked Prisma client instead of a live DB (tests cast a plain mock object
 * `as never`, matching `tests/packages.test.ts`).
 */

// A `drawing` row older than this is assumed to belong to a crashed request
// and is safe to reclaim (design.md D3).
export const DRAW_CLAIM_TIMEOUT_MS = 60_000

export type RaffleDrawWinner = {
  id: string
  name: string
  phoneE164: string
}

export type RunDrawResult =
  | { status: "drawn"; winner: RaffleDrawWinner }
  | { status: "in_progress" }
  | { status: "no_eligible_entries" }
  | { status: "not_found" }

export type RunDrawInput = {
  eventId: string
  drawId: string
  now: Date
}

type EligibleEntry = { id: string; name: string; phoneE164: string }

const toWinner = (entry: EligibleEntry): RaffleDrawWinner => ({
  id: entry.id,
  name: entry.name,
  phoneE164: entry.phoneE164,
})

/**
 * Re-read the draw after losing (or missing) the claim. A `drawn` draw
 * replays its persisted winner idempotently; anything else is a live
 * concurrent claim.
 */
const readCurrentDrawState = async (
  tx: Prisma.TransactionClient,
  eventId: string,
  drawId: string
): Promise<RunDrawResult> => {
  const draw = await tx.raffleDraw.findUnique({
    where: { id: drawId },
    include: { winnerEntry: true },
  })
  if (!draw || draw.eventId !== eventId) return { status: "not_found" }
  if (draw.status === "drawn" && draw.winnerEntry) {
    return { status: "drawn", winner: toWinner(draw.winnerEntry) }
  }
  return { status: "in_progress" }
}

export const runDraw = async (tx: Prisma.TransactionClient, input: RunDrawInput): Promise<RunDrawResult> => {
  const { eventId, drawId, now } = input
  const staleThreshold = new Date(now.getTime() - DRAW_CLAIM_TIMEOUT_MS)

  // Claim guard: only an `open` draw or a `drawing` draw stuck past the
  // timeout can be claimed. Under ReadCommitted, a losing concurrent request
  // re-evaluates this WHERE after the row lock is released and sees
  // `count === 0` (design.md D3).
  const claimed = await tx.raffleDraw.updateMany({
    where: {
      id: drawId,
      eventId,
      OR: [{ status: "open" }, { status: "drawing", drawingStartedAt: { lt: staleThreshold } }],
    },
    data: { status: "drawing", drawingStartedAt: now },
  })

  if (claimed.count === 0) {
    return readCurrentDrawState(tx, eventId, drawId)
  }

  const draw = await tx.raffleDraw.findUnique({
    where: { id: drawId },
    include: { event: true },
  })
  if (!draw || draw.eventId !== eventId) return { status: "not_found" }

  const priorWinnerIds = draw.event.excludePreviousWinners
    ? (
        await tx.raffleDraw.findMany({
          where: { eventId: draw.eventId, winnerEntryId: { not: null } },
          select: { winnerEntryId: true },
        })
      )
        .map((entry) => entry.winnerEntryId)
        .filter((id): id is string => id !== null)
    : []

  const eligibleEntries: EligibleEntry[] = await tx.raffleEntry.findMany({
    where: { eventId: draw.eventId, id: { notIn: priorWinnerIds } },
    select: { id: true, name: true, phoneE164: true },
    orderBy: { id: "asc" },
  })

  if (eligibleEntries.length === 0) {
    // Revert the claim so the draw stays runnable once more entries arrive
    // (design.md D4).
    await tx.raffleDraw.update({
      where: { id: drawId },
      data: { status: "open", drawingStartedAt: null },
    })
    return { status: "no_eligible_entries" }
  }

  const winner = eligibleEntries[randomInt(0, eligibleEntries.length)]

  await tx.raffleDraw.update({
    where: { id: drawId },
    data: { winnerEntryId: winner.id, drawnAt: now, status: "drawn" },
  })

  return { status: "drawn", winner: toWinner(winner) }
}
