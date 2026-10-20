import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  computePrizeDraftRevision,
  normalizePrizeLabels,
  updateDraftPrizes,
} from "@/lib/raffle/prizes"

const DRAW_AT = new Date("2026-10-31T04:00:00.000Z")
const UPDATED_AT = new Date("2026-10-19T12:00:00.000Z")
const draftDraws = [
  {
    id: "draw_1",
    order: 1,
    prizeLabel: "Small Prize",
    drawAt: DRAW_AT,
    status: "draft",
    winnerEntryId: null,
    updatedAt: UPDATED_AT,
    attempts: [],
  },
]

const mockTx = {
  raffleEvent: { findUnique: vi.fn() },
  raffleDraw: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
}

const revision = computePrizeDraftRevision(draftDraws)

beforeEach(() => {
  vi.clearAllMocks()
  mockTx.raffleEvent.findUnique.mockResolvedValue({ id: "event_1", draws: draftDraws })
  mockTx.raffleDraw.deleteMany.mockResolvedValue({ count: 1 })
  mockTx.raffleDraw.createMany.mockResolvedValue({ count: 2 })
  mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 2 })
  mockTx.raffleDraw.findMany.mockResolvedValue([
    { ...draftDraws[0], id: "draw_a", prizeLabel: "First", updatedAt: new Date("2026-10-19T12:01:00.000Z") },
    { ...draftDraws[0], id: "draw_b", order: 2, prizeLabel: "Second", updatedAt: new Date("2026-10-19T12:01:00.000Z") },
  ])
})

describe("normalizePrizeLabels", () => {
  it("trims one to fifty non-empty labels", () => {
    expect(normalizePrizeLabels([" First ", "Second"])).toEqual({ ok: true, labels: ["First", "Second"] })
    expect(normalizePrizeLabels([])).toEqual({ ok: false })
    expect(normalizePrizeLabels([" "])).toEqual({ ok: false })
    expect(normalizePrizeLabels(Array.from({ length: 51 }, (_, index) => `Prize ${index}`))).toEqual({ ok: false })
    expect(normalizePrizeLabels(["x".repeat(121)])).toEqual({ ok: false })
  })
})

describe("updateDraftPrizes", () => {
  it("replaces only draft draws while preserving the schedule anchor", async () => {
    const result = await updateDraftPrizes(mockTx as never, {
      eventId: "event_1",
      revision,
      labels: ["First", "Second"],
      action: "save",
    })

    expect(result).toMatchObject({ status: "saved", prizes: ["First", "Second"] })
    expect(mockTx.raffleDraw.deleteMany).toHaveBeenCalledWith({ where: { eventId: "event_1", status: "draft" } })
    expect(mockTx.raffleDraw.createMany).toHaveBeenCalledWith({
      data: [
        { eventId: "event_1", order: 1, prizeLabel: "First", drawAt: DRAW_AT, status: "draft" },
        { eventId: "event_1", order: 2, prizeLabel: "Second", drawAt: DRAW_AT, status: "draft" },
      ],
    })
    expect(mockTx.raffleDraw.updateMany).not.toHaveBeenCalled()
  })

  it("atomically saves the displayed order and opens every prize on Start raffle", async () => {
    const result = await updateDraftPrizes(mockTx as never, {
      eventId: "event_1",
      revision,
      labels: ["First", "Grand Prize"],
      action: "start",
    })

    expect(result).toEqual({ status: "started" })
    expect(mockTx.raffleDraw.createMany).toHaveBeenCalledWith({
      data: [
        { eventId: "event_1", order: 1, prizeLabel: "First", drawAt: DRAW_AT, status: "draft" },
        { eventId: "event_1", order: 2, prizeLabel: "Grand Prize", drawAt: DRAW_AT, status: "draft" },
      ],
    })
    expect(mockTx.raffleDraw.updateMany).toHaveBeenCalledWith({
      where: { eventId: "event_1", status: "draft" },
      data: { status: "open" },
    })
  })

  it("rejects a stale revision without changing stored draws", async () => {
    const result = await updateDraftPrizes(mockTx as never, {
      eventId: "event_1",
      revision: "stale",
      labels: ["First"],
      action: "save",
    })

    expect(result).toEqual({ status: "conflict" })
    expect(mockTx.raffleDraw.deleteMany).not.toHaveBeenCalled()
    expect(mockTx.raffleDraw.createMany).not.toHaveBeenCalled()
    expect(mockTx.raffleDraw.updateMany).not.toHaveBeenCalled()
  })

  it.each([
    ["already started", [{ ...draftDraws[0], status: "open" }]],
    ["mixed status", [draftDraws[0], { ...draftDraws[0], id: "draw_2", order: 2, status: "open" }]],
    ["winner history", [{ ...draftDraws[0], winnerEntryId: "entry_1" }]],
    ["attempt history", [{ ...draftDraws[0], attempts: [{ id: "attempt_1" }] }]],
  ])("rejects %s without mutating prizes", async (_label, draws) => {
    mockTx.raffleEvent.findUnique.mockResolvedValue({ id: "event_1", draws })

    const result = await updateDraftPrizes(mockTx as never, {
      eventId: "event_1",
      revision: computePrizeDraftRevision(draws),
      labels: ["First"],
      action: "save",
    })

    expect(result).toEqual({ status: "locked" })
    expect(mockTx.raffleDraw.deleteMany).not.toHaveBeenCalled()
    expect(mockTx.raffleDraw.createMany).not.toHaveBeenCalled()
    expect(mockTx.raffleDraw.updateMany).not.toHaveBeenCalled()
  })
})
