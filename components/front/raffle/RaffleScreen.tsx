"use client"

import { useCallback, useEffect, useReducer, useState } from "react"
import { useRaffleScreenState } from "./hooks/useRaffleScreenState"
import {
  initialRaffleScreenMachineState,
  raffleScreenReducer,
  selectCountdownMs,
  selectCurrentDraw,
  selectEntryCount,
  selectEntryUrl,
  selectVideoUrl,
} from "./raffleScreenMachine"
import RaffleScreenView from "./RaffleScreenView"

const TICK_INTERVAL_MS = 250

type DrawApiBody = { status?: string; winner?: { name: string; phoneLast4: string } } | null

/**
 * Maps the draw endpoint's documented responses (design.md's API contract:
 * `draw_in_progress`, `no_eligible_entries`, `draw_failed`, 404) to a
 * screen-readable message. Pure and exported so the mapping is testable
 * without mounting the component — same pattern as
 * `RaffleEntryForm.tsx`'s `resolveRaffleEntrySubmitOutcome`.
 */
export function resolveDrawFailureMessage(httpStatus: number, apiStatus: string | undefined): string {
  if (apiStatus === "draw_in_progress") return "This draw is already in progress. Try again in a moment."
  if (apiStatus === "no_eligible_entries") return "No eligible entries remain for this draw."
  if (apiStatus === "draw_failed" || httpStatus === 503) return "The draw failed on the server. Please try again."
  if (httpStatus === 404) return "This draw could not be found. Refresh the screen."
  return "Something went wrong. Please try again."
}

type RaffleScreenProps = {
  slug: string
  /**
   * Injectable reveal-readiness override (design.md D6), mainly for tests.
   * When omitted, readiness tracks the fullscreen draw video's own `ended`
   * event (wired below), so the reveal always waits for both the video
   * finishing and the draw response, whichever lands second.
   */
  isRevealReady?: () => boolean
}

/**
 * Client container: owns the screen's state machine, the ~5s poll, and the
 * countdown tick. Renders nothing itself — `RaffleScreenView` is the
 * presentational half (container/presentational split, per repo convention).
 */
export default function RaffleScreen({ slug, isRevealReady }: RaffleScreenProps) {
  const [state, dispatch] = useReducer(raffleScreenReducer, initialRaffleScreenMachineState)
  // Starts `true`: no draw is in flight yet, so there is nothing to wait on.
  // Reset to `false` the moment a draw starts, set back on the video's `ended`.
  const [videoEnded, setVideoEnded] = useState(true)
  const paused = state.phase === "drawing" || state.phase === "reveal"
  const { data } = useRaffleScreenState(slug, paused)

  useEffect(() => {
    if (data) dispatch({ type: "poll_success", payload: data })
  }, [data])

  useEffect(() => {
    if (state.phase !== "waiting") return
    const id = setInterval(() => dispatch({ type: "tick", nowMs: Date.now() }), TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [state.phase])

  const revealReady = useCallback(
    () => (isRevealReady ? isRevealReady() : videoEnded),
    [isRevealReady, videoEnded]
  )

  // Reveal gate (design.md D6): fires once a pending winner exists AND the
  // readiness signal allows it — by default the video's `ended` event, so
  // the reveal waits for whichever of {video, draw response} lands second.
  useEffect(() => {
    if (state.phase === "drawing" && state.pendingWinner && revealReady()) {
      dispatch({ type: "reveal_ready" })
    }
  }, [state.phase, state.pendingWinner, revealReady])

  const currentDraw = selectCurrentDraw(state)

  const handleVideoEnded = useCallback(() => setVideoEnded(true), [])

  const handleDraw = async () => {
    if (!currentDraw) return
    setVideoEnded(false)
    dispatch({ type: "draw_tapped" })
    try {
      const res = await fetch(`/api/raffle/${encodeURIComponent(slug)}/draws/${currentDraw.id}/draw`, {
        method: "POST",
      })
      const body = (await res.json().catch(() => null)) as DrawApiBody
      if (res.ok && body?.status === "drawn" && body.winner) {
        dispatch({ type: "draw_response_received", winner: body.winner })
        return
      }
      dispatch({ type: "draw_failed", message: resolveDrawFailureMessage(res.status, body?.status) })
    } catch {
      dispatch({ type: "draw_failed", message: "Could not reach the server. Check the connection and try again." })
    }
  }

  const handleNextDraw = () => dispatch({ type: "next_draw_tapped" })

  // Derived from the reducer's own clock (`state.nowMs`), not `Date.now()`
  // read here at render time — see raffleScreenMachine.ts's `tick` case.
  const countdownMs = selectCountdownMs(state)

  return (
    <RaffleScreenView
      phase={state.phase}
      prizeLabel={currentDraw?.prizeLabel ?? null}
      countdownMs={countdownMs}
      entryCount={selectEntryCount(state)}
      entryUrl={selectEntryUrl(state)}
      videoUrl={selectVideoUrl(state)}
      winner={state.winner}
      error={state.error}
      onDraw={handleDraw}
      onNextDraw={handleNextDraw}
      onVideoEnded={handleVideoEnded}
    />
  )
}
