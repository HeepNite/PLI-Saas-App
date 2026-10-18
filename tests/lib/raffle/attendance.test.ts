import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockTx, mockRunDraw } = vi.hoisted(() => ({
  mockTx: {
    raffleDrawAttempt: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    raffleDraw: { updateMany: vi.fn() },
  },
  mockRunDraw: vi.fn(),
}))

vi.mock("@/lib/raffle/draw", () => ({ runDraw: (...args: unknown[]) => mockRunDraw(...args) }))

import { resolveDrawAttendance } from "@/lib/raffle/attendance"

const NOW = new Date("2026-10-31T04:00:10.000Z")
const pendingAttempt = {
  id: "attempt_1",
  drawId: "draw_1",
  entryId: "entry_1",
  status: "pending",
  draw: { id: "draw_1", eventId: "event_1", status: "awaiting_confirmation", winnerEntryId: "entry_1" },
}

describe("resolveDrawAttendance", () => {
  beforeEach(() => {
    for (const model of Object.values(mockTx)) for (const fn of Object.values(model)) fn.mockReset()
    mockRunDraw.mockReset()
  })

  it("confirms the exact pending attempt and closes the prize", async () => {
    mockTx.raffleDrawAttempt.findUnique.mockResolvedValue(pendingAttempt)
    mockTx.raffleDrawAttempt.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })

    const result = await resolveDrawAttendance(mockTx as never, {
      eventId: "event_1", drawId: "draw_1", attemptId: "attempt_1", action: "showed_up", now: NOW,
    })

    expect(result).toEqual({ status: "confirmed" })
    expect(mockTx.raffleDrawAttempt.updateMany).toHaveBeenCalledWith({
      where: { id: "attempt_1", drawId: "draw_1", status: "pending" },
      data: { status: "confirmed", resolvedAt: NOW },
    })
    expect(mockTx.raffleDraw.updateMany).toHaveBeenCalledWith({
      where: { id: "draw_1", eventId: "event_1", status: "awaiting_confirmation", winnerEntryId: "entry_1" },
      data: { status: "drawn" },
    })
  })

  it("records a no-show and reruns the same prize", async () => {
    mockTx.raffleDrawAttempt.findUnique.mockResolvedValue(pendingAttempt)
    mockTx.raffleDrawAttempt.updateMany.mockResolvedValue({ count: 1 })
    mockTx.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockRunDraw.mockResolvedValue({
      status: "drawn", attemptId: "attempt_2", winner: { id: "entry_2", name: "Beto", phoneE164: "+12125552222" },
    })

    const result = await resolveDrawAttendance(mockTx as never, {
      eventId: "event_1", drawId: "draw_1", attemptId: "attempt_1", action: "draw_again", now: NOW,
    })

    expect(mockTx.raffleDrawAttempt.updateMany).toHaveBeenCalledWith({
      where: { id: "attempt_1", drawId: "draw_1", status: "pending" },
      data: { status: "no_show", resolvedAt: NOW },
    })
    expect(mockTx.raffleDraw.updateMany).toHaveBeenCalledWith({
      where: { id: "draw_1", eventId: "event_1", status: "awaiting_confirmation", winnerEntryId: "entry_1" },
      data: { status: "open", winnerEntryId: null, drawnAt: null, drawingStartedAt: null },
    })
    expect(mockRunDraw).toHaveBeenCalledWith(mockTx, { eventId: "event_1", drawId: "draw_1", now: NOW })
    expect(result).toEqual({
      status: "redrawn", attemptId: "attempt_2", winner: { id: "entry_2", name: "Beto", phoneE164: "+12125552222" },
    })
  })

  it("replays a resolved no-show without acting on the later pending winner", async () => {
    mockTx.raffleDrawAttempt.findUnique.mockResolvedValue({ ...pendingAttempt, status: "no_show" })
    mockTx.raffleDrawAttempt.findFirst.mockResolvedValue({
      id: "attempt_2",
      entry: { id: "entry_2", name: "Beto", phoneE164: "+12125552222" },
    })

    const result = await resolveDrawAttendance(mockTx as never, {
      eventId: "event_1", drawId: "draw_1", attemptId: "attempt_1", action: "draw_again", now: NOW,
    })

    expect(result).toEqual({
      status: "redrawn", attemptId: "attempt_2", winner: { id: "entry_2", name: "Beto", phoneE164: "+12125552222" },
    })
    expect(mockTx.raffleDrawAttempt.updateMany).not.toHaveBeenCalled()
    expect(mockRunDraw).not.toHaveBeenCalled()
  })

  it("rejects a stale confirmation after that attempt was marked no-show", async () => {
    mockTx.raffleDrawAttempt.findUnique.mockResolvedValue({ ...pendingAttempt, status: "no_show" })

    const result = await resolveDrawAttendance(mockTx as never, {
      eventId: "event_1", drawId: "draw_1", attemptId: "attempt_1", action: "showed_up", now: NOW,
    })

    expect(result).toEqual({ status: "conflict" })
    expect(mockTx.raffleDraw.updateMany).not.toHaveBeenCalled()
  })
})
