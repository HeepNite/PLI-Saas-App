import type { RaffleScreenStatePayload, RaffleScreenWinnerPayload } from "./hooks/useRaffleScreenState"

/**
 * Screen state machine (design.md D6). `drawing_video` from the design
 * diagram is split here into `drawing` — this slice has no video, so a
 * successful response can reveal immediately once the injectable readiness
 * signal (see `RaffleScreen.tsx`'s `isRevealReady`) allows it. PR4b2 plugs
 * the fullscreen video into that same signal without touching this reducer.
 */
export type RafflePhase = "waiting" | "ready" | "drawing" | "reveal" | "between_draws" | "finished"

export type RaffleScreenMachineState = {
  phase: RafflePhase
  /** The draw whose countdown/reveal is currently tracked, or null before the first poll. */
  trackedDrawId: string | null
  /** Set once the draw endpoint responds, held until the readiness signal allows the reveal. */
  pendingWinner: RaffleScreenWinnerPayload | null
  winner: RaffleScreenWinnerPayload | null
  error: string | null
  /** Clock-drift correction: `Date.parse(payload.now) - Date.now()` at the last successful poll. */
  serverOffsetMs: number
  /** Most recent poll payload, kept even while `phase` is `drawing`/`reveal` so
   * `next_draw_tapped` can resolve without waiting for another round trip. */
  lastPayload: RaffleScreenStatePayload | null
  /** Last clock reading the reducer observed (from `tick` or `poll_success`).
   * The countdown must be derived from this, never from `Date.now()` read
   * during render — otherwise a `tick` that keeps the same phase returns an
   * identical object and React never re-renders the ticking countdown. */
  nowMs: number
}

export type RaffleScreenMachineAction =
  | { type: "poll_success"; payload: RaffleScreenStatePayload }
  | { type: "tick"; nowMs: number }
  | { type: "draw_tapped" }
  | { type: "draw_response_received"; winner: RaffleScreenWinnerPayload }
  | { type: "reveal_ready" }
  | { type: "draw_failed"; message: string }
  | { type: "next_draw_tapped" }

export const initialRaffleScreenMachineState: RaffleScreenMachineState = {
  phase: "waiting",
  trackedDrawId: null,
  pendingWinner: null,
  winner: null,
  error: null,
  serverOffsetMs: 0,
  lastPayload: null,
  nowMs: 0,
}

/** design.md D6 — the countdown is `drawAt - (Date.now() + offset)`, never the raw client clock. */
export const computeCountdownMs = (drawAt: string | null, nowMs: number, serverOffsetMs: number): number => {
  if (!drawAt) return 0
  return Date.parse(drawAt) - (nowMs + serverOffsetMs)
}

export const formatCountdownMs = (ms: number): string => {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export const selectCurrentDraw = (state: RaffleScreenMachineState) =>
  state.lastPayload && state.trackedDrawId
    ? state.lastPayload.draws.find((draw) => draw.id === state.trackedDrawId) ?? null
    : null

export const selectEntryCount = (state: RaffleScreenMachineState): number => state.lastPayload?.entryCount ?? 0

export const selectEntryUrl = (state: RaffleScreenMachineState): string | null =>
  state.lastPayload?.event.entryUrl ?? null

/** Countdown derived from the reducer's own clock (`state.nowMs`), never `Date.now()` at render time. */
export const selectCountdownMs = (state: RaffleScreenMachineState): number =>
  computeCountdownMs(selectCurrentDraw(state)?.drawAt ?? null, state.nowMs, state.serverOffsetMs)

/**
 * Pure state transitions for the tablet screen. Every branch is a reducer
 * case so the whole machine — including the polling/countdown/draw/retry
 * paths — is testable without mounting a component.
 */
export function raffleScreenReducer(
  state: RaffleScreenMachineState,
  action: RaffleScreenMachineAction
): RaffleScreenMachineState {
  switch (action.type) {
    case "poll_success": {
      const { payload } = action
      const nowMs = Date.now()
      const serverOffsetMs = Date.parse(payload.now) - nowMs
      const next = { ...state, lastPayload: payload, serverOffsetMs, nowMs }

      // Never let a poll preempt an in-flight draw or the reveal being shown.
      if (state.phase === "drawing" || state.phase === "reveal") return next

      if (payload.currentDrawId === null) {
        return { ...next, phase: "finished", trackedDrawId: null }
      }
      if (payload.currentDrawId !== state.trackedDrawId) {
        return { ...next, phase: "waiting", trackedDrawId: payload.currentDrawId, winner: null, error: null }
      }
      return next
    }

    case "tick": {
      if (state.phase !== "waiting") return state
      // Always return a new object so a ticking countdown re-renders even
      // when the phase doesn't change (R3-countdown-frozen-between-polls).
      const draw = selectCurrentDraw(state)
      // No tracked draw (or none with a drawAt) yet: nothing has actually
      // elapsed, so stay in `waiting` — never promote on absent data
      // (R3-tick-promotes-ready-without-draw).
      if (!draw?.drawAt) return { ...state, nowMs: action.nowMs }
      const countdownMs = computeCountdownMs(draw.drawAt, action.nowMs, state.serverOffsetMs)
      if (countdownMs > 0) return { ...state, nowMs: action.nowMs }
      return { ...state, phase: "ready", nowMs: action.nowMs }
    }

    case "draw_tapped":
      if (state.phase !== "ready") return state
      return { ...state, phase: "drawing", error: null, pendingWinner: null }

    case "draw_response_received":
      if (state.phase !== "drawing") return state
      return { ...state, pendingWinner: action.winner }

    case "reveal_ready":
      if (state.phase !== "drawing" || !state.pendingWinner) return state
      return { ...state, phase: "reveal", winner: state.pendingWinner, pendingWinner: null }

    case "draw_failed":
      if (state.phase !== "drawing") return state
      return { ...state, phase: "ready", error: action.message, pendingWinner: null }

    case "next_draw_tapped": {
      if (state.phase !== "reveal") return state
      const latestCurrentDrawId = state.lastPayload?.currentDrawId ?? null
      if (latestCurrentDrawId === null) {
        return { ...state, phase: "finished", trackedDrawId: null, winner: null }
      }
      if (latestCurrentDrawId !== state.trackedDrawId) {
        return { ...state, phase: "waiting", trackedDrawId: latestCurrentDrawId, winner: null, error: null }
      }
      // Server hasn't caught up to this draw being `drawn` yet; the next
      // `poll_success` resolves this the same way once it does.
      return { ...state, phase: "between_draws", winner: null }
    }

    default:
      return state
  }
}
