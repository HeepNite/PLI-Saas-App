import { describe, expect, it } from "vitest"
import {
  computeCountdownMs,
  formatCountdownMs,
  initialRaffleScreenMachineState,
  raffleScreenReducer,
  selectCurrentDraw,
  selectEntryCount,
  selectEntryUrl,
  type RaffleScreenMachineState,
} from "@/components/front/raffle/raffleScreenMachine"
import type { RaffleScreenStatePayload } from "@/components/front/raffle/hooks/useRaffleScreenState"

const payload = (overrides: Partial<RaffleScreenStatePayload> = {}): RaffleScreenStatePayload => ({
  now: "2026-09-12T23:00:00.000Z",
  event: { slug: "s1", title: "PLE Launch Night", entryUrl: "https://pli.test/raffle/s1" },
  entryCount: 5,
  currentDrawId: "draw_1",
  draws: [
    { id: "draw_1", order: 1, prizeLabel: "Grand Prize", status: "open", drawAt: "2026-09-12T23:00:10.000Z" },
  ],
  ...overrides,
})

describe("computeCountdownMs", () => {
  it("returns 0 when there is no scheduled drawAt", () => {
    expect(computeCountdownMs(null, 1_000, 0)).toBe(0)
  })

  it("subtracts the server-clock offset from the raw client time", () => {
    // client clock is 2s fast (offset -2000); drawAt is 5s after the real now.
    const drawAt = new Date(10_000 + 5_000).toISOString()
    expect(computeCountdownMs(drawAt, 12_000, -2_000)).toBe(5_000)
  })
})

describe("formatCountdownMs", () => {
  it("formats whole minutes and seconds, zero-padded", () => {
    expect(formatCountdownMs(65_000)).toBe("1:05")
  })

  it("clamps a negative countdown to 0:00", () => {
    expect(formatCountdownMs(-500)).toBe("0:00")
  })
})

describe("raffleScreenReducer — poll_success", () => {
  it("moves to waiting and tracks the new current draw on first poll", () => {
    const next = raffleScreenReducer(initialRaffleScreenMachineState, { type: "poll_success", payload: payload() })
    expect(next.phase).toBe("waiting")
    expect(next.trackedDrawId).toBe("draw_1")
  })

  it("moves to finished when currentDrawId is null", () => {
    const next = raffleScreenReducer(initialRaffleScreenMachineState, {
      type: "poll_success",
      payload: payload({ currentDrawId: null, draws: [] }),
    })
    expect(next.phase).toBe("finished")
    expect(next.trackedDrawId).toBeNull()
  })

  it("keeps the current phase when the tracked draw is unchanged", () => {
    const ready: RaffleScreenMachineState = {
      ...initialRaffleScreenMachineState,
      phase: "ready",
      trackedDrawId: "draw_1",
    }
    const next = raffleScreenReducer(ready, { type: "poll_success", payload: payload({ entryCount: 9 }) })
    expect(next.phase).toBe("ready")
    expect(selectEntryCount(next)).toBe(9)
  })

  it("never preempts an in-flight draw or the reveal being shown", () => {
    const drawing: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "drawing" }
    const next = raffleScreenReducer(drawing, {
      type: "poll_success",
      payload: payload({ currentDrawId: null }),
    })
    expect(next.phase).toBe("drawing")
    expect(next.lastPayload?.currentDrawId).toBeNull() // bookkeeping still updates
  })
})

describe("raffleScreenReducer — tick", () => {
  const waitingWithDraw = (drawAt: string): RaffleScreenMachineState => ({
    ...initialRaffleScreenMachineState,
    phase: "waiting",
    trackedDrawId: "draw_1",
    lastPayload: payload({ draws: [{ id: "draw_1", order: 1, prizeLabel: "Grand Prize", status: "open", drawAt }] }),
  })

  it("reveals the Draw button once the countdown reaches zero", () => {
    const state = waitingWithDraw(new Date(1_000).toISOString())
    const next = raffleScreenReducer(state, { type: "tick", nowMs: 5_000 })
    expect(next.phase).toBe("ready")
  })

  it("stays waiting while the countdown has not elapsed, but still advances its own clock", () => {
    const state = waitingWithDraw(new Date(50_000).toISOString())
    const next = raffleScreenReducer(state, { type: "tick", nowMs: 5_000 })
    expect(next.phase).toBe("waiting")
    expect(next).not.toBe(state) // R3-countdown-frozen-between-polls: always a new object
    expect(next.nowMs).toBe(5_000)
  })

  it("stays in waiting on tick when there is no tracked draw yet (e.g. before the first poll)", () => {
    const state: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "waiting" }
    const next = raffleScreenReducer(state, { type: "tick", nowMs: 999_999 })
    expect(next.phase).toBe("waiting") // R3-tick-promotes-ready-without-draw
  })

  it("is a no-op outside the waiting phase", () => {
    const state: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "ready" }
    const next = raffleScreenReducer(state, { type: "tick", nowMs: 999_999 })
    expect(next).toBe(state)
  })
})

describe("raffleScreenReducer — draw lifecycle", () => {
  const ready: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "ready", trackedDrawId: "draw_1" }

  it("draw_tapped moves ready -> drawing and clears any prior error", () => {
    const withError = { ...ready, error: "stale" }
    const next = raffleScreenReducer(withError, { type: "draw_tapped" })
    expect(next.phase).toBe("drawing")
    expect(next.error).toBeNull()
  })

  it("draw_tapped is a no-op outside the ready phase", () => {
    const waiting: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "waiting" }
    expect(raffleScreenReducer(waiting, { type: "draw_tapped" })).toBe(waiting)
  })

  it("draw_response_received stores a pending winner without revealing yet", () => {
    const drawing: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "drawing" }
    const next = raffleScreenReducer(drawing, {
      type: "draw_response_received",
      winner: { name: "Jane Doe", phoneLast4: "1234" },
    })
    expect(next.phase).toBe("drawing")
    expect(next.pendingWinner).toEqual({ name: "Jane Doe", phoneLast4: "1234" })
    expect(next.winner).toBeNull()
  })

  it("reveal_ready reveals the pending winner and clears the pending slot", () => {
    const drawingWithPending: RaffleScreenMachineState = {
      ...initialRaffleScreenMachineState,
      phase: "drawing",
      pendingWinner: { name: "Jane Doe", phoneLast4: "1234" },
    }
    const next = raffleScreenReducer(drawingWithPending, { type: "reveal_ready" })
    expect(next.phase).toBe("reveal")
    expect(next.winner).toEqual({ name: "Jane Doe", phoneLast4: "1234" })
    expect(next.pendingWinner).toBeNull()
  })

  it("reveal_ready is a no-op without a pending winner", () => {
    const drawing: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "drawing" }
    expect(raffleScreenReducer(drawing, { type: "reveal_ready" })).toBe(drawing)
  })

  it("draw_failed returns to ready with a retryable error and no pending winner", () => {
    const drawing: RaffleScreenMachineState = {
      ...initialRaffleScreenMachineState,
      phase: "drawing",
      pendingWinner: { name: "Jane Doe", phoneLast4: "1234" },
    }
    const next = raffleScreenReducer(drawing, { type: "draw_failed", message: "This draw is already in progress." })
    expect(next.phase).toBe("ready")
    expect(next.error).toBe("This draw is already in progress.")
    expect(next.pendingWinner).toBeNull()
  })
})

describe("raffleScreenReducer — next_draw_tapped", () => {
  const revealState = (currentDrawId: string | null): RaffleScreenMachineState => ({
    ...initialRaffleScreenMachineState,
    phase: "reveal",
    trackedDrawId: "draw_1",
    winner: { name: "Jane Doe", phoneLast4: "1234" },
    lastPayload: payload({ currentDrawId }),
  })

  it("advances to the next draw once the server reports a different current draw", () => {
    const next = raffleScreenReducer(revealState("draw_2"), { type: "next_draw_tapped" })
    expect(next.phase).toBe("waiting")
    expect(next.trackedDrawId).toBe("draw_2")
    expect(next.winner).toBeNull()
  })

  it("shows the closing state once there is no next draw", () => {
    const next = raffleScreenReducer(revealState(null), { type: "next_draw_tapped" })
    expect(next.phase).toBe("finished")
    expect(next.trackedDrawId).toBeNull()
  })

  it("waits in between_draws while the server has not caught up yet", () => {
    const next = raffleScreenReducer(revealState("draw_1"), { type: "next_draw_tapped" })
    expect(next.phase).toBe("between_draws")
  })

  it("is a no-op outside the reveal phase", () => {
    const waiting: RaffleScreenMachineState = { ...initialRaffleScreenMachineState, phase: "waiting" }
    expect(raffleScreenReducer(waiting, { type: "next_draw_tapped" })).toBe(waiting)
  })
})

describe("selectors", () => {
  it("return safe defaults before the first poll", () => {
    expect(selectCurrentDraw(initialRaffleScreenMachineState)).toBeNull()
    expect(selectEntryCount(initialRaffleScreenMachineState)).toBe(0)
    expect(selectEntryUrl(initialRaffleScreenMachineState)).toBeNull()
  })

  it("resolve the tracked draw and entry data once a poll has landed", () => {
    const state: RaffleScreenMachineState = {
      ...initialRaffleScreenMachineState,
      trackedDrawId: "draw_1",
      lastPayload: payload(),
    }
    expect(selectCurrentDraw(state)?.prizeLabel).toBe("Grand Prize")
    expect(selectEntryCount(state)).toBe(5)
    expect(selectEntryUrl(state)).toBe("https://pli.test/raffle/s1")
  })
})
