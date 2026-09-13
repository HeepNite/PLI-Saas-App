"use client"

import { RaffleDrawVideoOverlay, RaffleQrPanel } from "./RaffleScreenSeams"
import { formatCountdownMs, type RafflePhase } from "./raffleScreenMachine"
import type { RaffleScreenWinnerPayload } from "./hooks/useRaffleScreenState"
import RaffleBackdrop from "./RaffleBackdrop"

type RaffleScreenViewProps = {
  phase: RafflePhase
  prizeLabel: string | null
  countdownMs: number
  entryCount: number
  entryUrl: string | null
  videoUrl: string
  winner: RaffleScreenWinnerPayload | null
  error: string | null
  onDraw: () => void
  onNextDraw: () => void
  onVideoEnded: () => void
}

// Content can scroll on short tablets rather than clipping controls.
const SHELL_CLASS =
  "flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-4 py-6 text-center text-white sm:gap-6 sm:px-6"

/**
 * Presentational: renders one screen per `RafflePhase`. Owns no state and
 * makes no requests — `RaffleScreen.tsx` (the container) drives every prop.
 */
export default function RaffleScreenView({
  phase,
  prizeLabel,
  countdownMs,
  entryCount,
  entryUrl,
  videoUrl,
  winner,
  error,
  onDraw,
  onNextDraw,
  onVideoEnded,
}: RaffleScreenViewProps) {
  // Mounted on every phase, not just `drawing` — see RaffleScreenSeams.tsx —
  // so the browser starts buffering the file long before it is needed.
  const videoOverlay = <RaffleDrawVideoOverlay videoUrl={videoUrl} active={phase === "drawing"} onEnded={onVideoEnded} />

  if (phase === "finished") {
    return (
      <>
        {videoOverlay}
        <RaffleBackdrop className={SHELL_CLASS}>
          <p className="text-3xl font-semibold">Thanks for playing!</p>
          <p className="text-white/60">All draws for tonight are complete.</p>
        </RaffleBackdrop>
      </>
    )
  }

  if (phase === "reveal" && winner) {
    return (
      <>
        {videoOverlay}
        <RaffleBackdrop className={SHELL_CLASS}>
          <p className="text-lg uppercase tracking-widest text-white/50">Winner</p>
          <p className="max-w-full break-words text-4xl font-bold sm:text-6xl">{winner.name}</p>
          <p className="text-2xl text-white/70">{"••• ••• " + winner.phoneLast4}</p>
          {prizeLabel ? (
            <div className="max-w-full space-y-1">
              <p className="text-sm uppercase tracking-widest text-white/70">Prize won</p>
              <p className="break-words text-2xl font-semibold sm:text-3xl">{prizeLabel}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onNextDraw}
            className="min-h-11 rounded-lg bg-[var(--brand,#b61616)] px-6 py-3 text-lg font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90"
          >
            Next draw
          </button>
        </RaffleBackdrop>
      </>
    )
  }

  if (phase === "between_draws") {
    return (
      <>
        {videoOverlay}
        <RaffleBackdrop className={SHELL_CLASS}>
          <p className="text-2xl font-semibold text-white/70">Getting the next draw ready&hellip;</p>
        </RaffleBackdrop>
      </>
    )
  }

  if (phase === "drawing") {
    return (
      <>
        {videoOverlay}
        <RaffleBackdrop className={SHELL_CLASS}>
          <p className="text-2xl font-semibold">Drawing&hellip;</p>
        </RaffleBackdrop>
      </>
    )
  }

  // waiting or ready
  return (
    <>
      {videoOverlay}
      <RaffleBackdrop className={SHELL_CLASS}>
        {prizeLabel ? <p className="text-xl font-semibold text-white/80">{prizeLabel}</p> : null}
        <p className="text-7xl font-bold tabular-nums">{formatCountdownMs(countdownMs)}</p>
        <p className="text-white/60">{entryCount} entered</p>
        <RaffleQrPanel entryUrl={entryUrl} />
        {error ? (
          <p role="alert" className="text-sm text-[var(--brand,#b61616)]">
            {error}
          </p>
        ) : null}
        {phase === "ready" ? (
          <button
            type="button"
            onClick={onDraw}
            className="min-h-11 rounded-lg bg-[var(--brand,#b61616)] px-8 py-4 text-xl font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90"
          >
            Draw
          </button>
        ) : null}
      </RaffleBackdrop>
    </>
  )
}
