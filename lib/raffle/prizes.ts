import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"

type PrizeTransaction = Pick<Prisma.TransactionClient, "raffleEvent" | "raffleDraw">

type PrizeDraftSnapshot = {
  id: string
  order: number
  prizeLabel: string
  drawAt: Date | null
  status: string
  winnerEntryId: string | null
  updatedAt: Date
  attempts: Array<{ id: string }>
}

export type PrizeMutationAction = "save" | "start"

export type PrizeMutationResult =
  | { status: "saved"; revision: string; prizes: string[] }
  | { status: "started" }
  | { status: "conflict" | "locked" | "not_found" }

export const normalizePrizeLabels = (input: unknown): { ok: true; labels: string[] } | { ok: false } => {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) return { ok: false }
  const labels: string[] = []
  for (const value of input) {
    if (typeof value !== "string") return { ok: false }
    const label = value.trim()
    if (!label || label.length > 120) return { ok: false }
    labels.push(label)
  }
  return { ok: true, labels }
}

export const computePrizeDraftRevision = (draws: PrizeDraftSnapshot[]): string => {
  const snapshot = [...draws]
    .sort((left, right) => left.order - right.order)
    .map((draw) => [
      draw.id,
      draw.order,
      draw.prizeLabel,
      draw.drawAt?.toISOString() ?? null,
      draw.status,
      draw.winnerEntryId,
      draw.updatedAt.toISOString(),
      draw.attempts.map((attempt) => attempt.id).sort(),
    ])
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
}

export const updateDraftPrizes = async (
  tx: PrizeTransaction,
  input: {
    eventId: string
    revision: string
    labels: string[]
    action: PrizeMutationAction
  }
): Promise<PrizeMutationResult> => {
  const event = await tx.raffleEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      draws: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          prizeLabel: true,
          drawAt: true,
          status: true,
          winnerEntryId: true,
          updatedAt: true,
          attempts: { select: { id: true } },
        },
      },
    },
  })
  if (!event) return { status: "not_found" }

  const draws = event.draws as PrizeDraftSnapshot[]
  const editable =
    draws.length > 0 &&
    draws.every(
      (draw) => draw.status === "draft" && draw.winnerEntryId === null && draw.attempts.length === 0
    )
  if (!editable) return { status: "locked" }
  if (computePrizeDraftRevision(draws) !== input.revision) return { status: "conflict" }

  const drawAt = draws[0].drawAt
  await tx.raffleDraw.deleteMany({ where: { eventId: input.eventId, status: "draft" } })
  await tx.raffleDraw.createMany({
    data: input.labels.map((prizeLabel, index) => ({
      eventId: input.eventId,
      order: index + 1,
      prizeLabel,
      drawAt,
      status: "draft",
    })),
  })

  if (input.action === "start") {
    await tx.raffleDraw.updateMany({
      where: { eventId: input.eventId, status: "draft" },
      data: { status: "open" },
    })
    return { status: "started" }
  }

  const savedDraws = (await tx.raffleDraw.findMany({
    where: { eventId: input.eventId, status: "draft" },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      prizeLabel: true,
      drawAt: true,
      status: true,
      winnerEntryId: true,
      updatedAt: true,
      attempts: { select: { id: true } },
    },
  })) as PrizeDraftSnapshot[]

  return {
    status: "saved",
    revision: computePrizeDraftRevision(savedDraws),
    prizes: savedDraws.map((draw) => draw.prizeLabel),
  }
}
