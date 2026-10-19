import type { Prisma } from "@prisma/client"
import { runDraw, type RaffleDrawWinner } from "@/lib/raffle/draw"

export type DrawAttendanceAction = "showed_up" | "draw_again"

export type ResolveDrawAttendanceInput = {
  eventId: string
  drawId: string
  attemptId: string
  action: DrawAttendanceAction
  now: Date
}

export type ResolveDrawAttendanceResult =
  | { status: "confirmed" }
  | { status: "redrawn"; attemptId: string; winner: RaffleDrawWinner }
  | { status: "no_eligible_entries" }
  | { status: "conflict" }
  | { status: "not_found" }

const replayResolvedAttempt = async (
  tx: Prisma.TransactionClient,
  input: ResolveDrawAttendanceInput,
  attemptStatus: string
): Promise<ResolveDrawAttendanceResult> => {
  if (input.action === "showed_up" && attemptStatus === "confirmed") return { status: "confirmed" }
  if (input.action !== "draw_again" || attemptStatus !== "no_show") return { status: "conflict" }

  const current = await tx.raffleDrawAttempt.findFirst({
    where: { drawId: input.drawId, status: "pending" },
    include: { entry: true },
    orderBy: { selectedAt: "desc" },
  })
  if (!current) return { status: "conflict" }
  return {
    status: "redrawn",
    attemptId: current.id,
    winner: { id: current.entry.id, name: current.entry.name, phoneE164: current.entry.phoneE164 },
  }
}

export const resolveDrawAttendance = async (
  tx: Prisma.TransactionClient,
  input: ResolveDrawAttendanceInput
): Promise<ResolveDrawAttendanceResult> => {
  const attempt = await tx.raffleDrawAttempt.findUnique({
    where: { id: input.attemptId },
    include: { draw: true },
  })
  if (!attempt || attempt.drawId !== input.drawId || attempt.draw.eventId !== input.eventId) {
    return { status: "not_found" }
  }
  if (attempt.status !== "pending") return replayResolvedAttempt(tx, input, attempt.status)

  if (input.action === "showed_up") {
    const draw = await tx.raffleDraw.updateMany({
      where: {
        id: input.drawId,
        eventId: input.eventId,
        status: "awaiting_confirmation",
        winnerEntryId: attempt.entryId,
      },
      data: { status: "drawn" },
    })
    if (draw.count === 0) return { status: "conflict" }
    const resolved = await tx.raffleDrawAttempt.updateMany({
      where: { id: input.attemptId, drawId: input.drawId, status: "pending" },
      data: { status: "confirmed", resolvedAt: input.now },
    })
    if (resolved.count === 0) throw new Error("attendance attempt changed during confirmation")
    return { status: "confirmed" }
  }

  const draw = await tx.raffleDraw.updateMany({
    where: {
      id: input.drawId,
      eventId: input.eventId,
      status: "awaiting_confirmation",
      winnerEntryId: attempt.entryId,
    },
    data: { status: "open", winnerEntryId: null, drawnAt: null, drawingStartedAt: null },
  })
  if (draw.count === 0) return { status: "conflict" }
  const resolved = await tx.raffleDrawAttempt.updateMany({
    where: { id: input.attemptId, drawId: input.drawId, status: "pending" },
    data: { status: "no_show", resolvedAt: input.now },
  })
  if (resolved.count === 0) throw new Error("attendance attempt changed during redraw")

  const rerun = await runDraw(tx, { eventId: input.eventId, drawId: input.drawId, now: input.now })
  if (rerun.status === "drawn" && rerun.attemptId) {
    return { status: "redrawn", attemptId: rerun.attemptId, winner: rerun.winner }
  }
  if (rerun.status === "no_eligible_entries") return { status: "no_eligible_entries" }
  return rerun.status === "not_found" ? { status: "not_found" } : { status: "conflict" }
}
