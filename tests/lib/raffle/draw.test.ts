import { beforeEach, describe, expect, it, vi } from "vitest"

const mockRandomInt = vi.fn()

vi.mock("node:crypto", () => ({
  randomInt: (...args: unknown[]) => mockRandomInt(...args),
}))

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    raffleDraw: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    raffleEntry: {
      findMany: vi.fn(),
    },
  },
}))

import { runDraw, DRAW_CLAIM_TIMEOUT_MS } from "@/lib/raffle/draw"

const NOW = new Date("2026-09-12T23:30:00.000Z")

const EVENT = { id: "event_1", excludePreviousWinners: false }

const DRAW_WITH_EVENT = { id: "draw_1", eventId: "event_1", status: "drawing", event: EVENT }

const ENTRIES = [
  { id: "entry_1", name: "Ana Lopez", phoneE164: "+12125551111" },
  { id: "entry_2", name: "Beto Cruz", phoneE164: "+12125552222" },
  { id: "entry_3", name: "Cami Diaz", phoneE164: "+12125553333" },
]

describe("runDraw", () => {
  beforeEach(() => {
    mockRandomInt.mockReset()
    mockTx.raffleDraw.updateMany.mockReset()
    mockTx.raffleDraw.findUnique.mockReset()
    mockTx.raffleDraw.findMany.mockReset()
    mockTx.raffleDraw.update.mockReset()
    mockTx.raffleEntry.findMany.mockReset()
  })

  it("picks the stubbed index among eligible entries and persists the winner", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.findUnique.mockResolvedValue(DRAW_WITH_EVENT)
    mockTx.raffleEntry.findMany.mockResolvedValue(ENTRIES)
    mockRandomInt.mockReturnValue(1)

    const result = await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(mockRandomInt).toHaveBeenCalledWith(0, 3)
    expect(result).toEqual({
      status: "drawn",
      winner: { id: "entry_2", name: "Beto Cruz", phoneE164: "+12125552222" },
    })
    expect(mockTx.raffleDraw.update).toHaveBeenCalledWith({
      where: { id: "draw_1" },
      data: { winnerEntryId: "entry_2", drawnAt: NOW, status: "drawn" },
    })
  })

  it("replays the persisted winner when the draw is already drawn", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockTx.raffleDraw.findUnique.mockResolvedValue({
      id: "draw_1",
      eventId: "event_1",
      status: "drawn",
      winnerEntry: { id: "entry_2", name: "Beto Cruz", phoneE164: "+12125552222" },
    })

    const result = await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(result).toEqual({
      status: "drawn",
      winner: { id: "entry_2", name: "Beto Cruz", phoneE164: "+12125552222" },
    })
    expect(mockTx.raffleDraw.update).not.toHaveBeenCalled()
  })

  it("returns in_progress when the claim is lost to a concurrent request", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockTx.raffleDraw.findUnique.mockResolvedValue({ id: "draw_1", eventId: "event_1", status: "drawing", winnerEntry: null })

    const result = await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(result).toEqual({ status: "in_progress" })
  })

  it("returns not_found when the draw belongs to another event", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockTx.raffleDraw.findUnique.mockResolvedValue({
      id: "draw_1",
      eventId: "event_other",
      status: "drawn",
      winnerEntry: { id: "entry_2", name: "Beto Cruz", phoneE164: "+12125552222" },
    })

    const result = await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(result).toEqual({ status: "not_found" })
  })

  it("scopes the claim guard to the event", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.findUnique.mockResolvedValue(DRAW_WITH_EVENT)
    mockTx.raffleEntry.findMany.mockResolvedValue(ENTRIES)
    mockRandomInt.mockReturnValue(0)

    await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(mockTx.raffleDraw.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ eventId: "event_1" }) })
    )
  })

  it("returns not_found when the draw does not exist", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockTx.raffleDraw.findUnique.mockResolvedValue(null)

    const result = await runDraw(mockTx as never, { eventId: "event_1", drawId: "missing", now: NOW })

    expect(result).toEqual({ status: "not_found" })
  })

  it("reclaims a drawing row stuck stale for longer than the timeout", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.findUnique.mockResolvedValue(DRAW_WITH_EVENT)
    mockTx.raffleEntry.findMany.mockResolvedValue(ENTRIES)
    mockRandomInt.mockReturnValue(0)

    await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    const [[claimArgs]] = mockTx.raffleDraw.updateMany.mock.calls
    const staleClause = claimArgs.where.OR[1]
    expect(staleClause.status).toBe("drawing")
    expect(staleClause.drawingStartedAt.lt.getTime()).toBe(NOW.getTime() - DRAW_CLAIM_TIMEOUT_MS)
  })

  it("excludes prior winners of the same event when excludePreviousWinners is on", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.findUnique.mockResolvedValue({
      ...DRAW_WITH_EVENT,
      event: { id: "event_1", excludePreviousWinners: true },
    })
    mockTx.raffleDraw.findMany.mockResolvedValue([{ winnerEntryId: "entry_1" }, { winnerEntryId: null }])
    mockTx.raffleEntry.findMany.mockResolvedValue([ENTRIES[1], ENTRIES[2]])
    mockRandomInt.mockReturnValue(0)

    await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(mockTx.raffleEntry.findMany).toHaveBeenCalledWith({
      where: { eventId: "event_1", id: { notIn: ["entry_1"] } },
      select: { id: true, name: true, phoneE164: true },
      orderBy: { id: "asc" },
    })
  })

  it("includes prior winners when excludePreviousWinners is off", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.findUnique.mockResolvedValue(DRAW_WITH_EVENT)
    mockTx.raffleEntry.findMany.mockResolvedValue(ENTRIES)
    mockRandomInt.mockReturnValue(0)

    await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(mockTx.raffleDraw.findMany).not.toHaveBeenCalled()
    expect(mockTx.raffleEntry.findMany).toHaveBeenCalledWith({
      where: { eventId: "event_1", id: { notIn: [] } },
      select: { id: true, name: true, phoneE164: true },
      orderBy: { id: "asc" },
    })
  })

  it("reverts the claim to open and reports no_eligible_entries when nobody qualifies", async () => {
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.findUnique.mockResolvedValue(DRAW_WITH_EVENT)
    mockTx.raffleEntry.findMany.mockResolvedValue([])

    const result = await runDraw(mockTx as never, { eventId: "event_1", drawId: "draw_1", now: NOW })

    expect(result).toEqual({ status: "no_eligible_entries" })
    expect(mockTx.raffleDraw.update).toHaveBeenCalledWith({
      where: { id: "draw_1" },
      data: { status: "open", drawingStartedAt: null },
    })
    expect(mockRandomInt).not.toHaveBeenCalled()
  })
})
