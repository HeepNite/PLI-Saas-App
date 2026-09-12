"use client"

import { RaffleDrawVideoOverlay, RaffleQrPanel } from "./RaffleScreenSeams"
import { formatCountdownMs, type RafflePhase } from "./raffleScreenMachine"
import type { RaffleScreenWinnerPayload } from "./hooks/useRaffleScreenState"

type RaffleScreenViewProps = {
  phase: RafflePhase
  prizeLabel: string | null
  countdownMs: number
  entryCount: number
  entryUrl: string | null
  winner: RaffleScreenWinnerPayload | null
  error: string | null
  onDraw: () => void
  onNextDraw: () => void
}

// Full-viewport dark shell, same idiom as StaffTerminalShell.tsx's
// `bg-[#13141d]` loading screen (design.md's "Codebase facts" section) —
// reused by copy since that file is not modified.
const SHELL_CLASS =
  "flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#13141d] px-6 py-10 text-center text-white"

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
  winner,
  error,
  onDraw,
  onNextDraw,
}: RaffleScreenViewProps) {
  if (phase === "finished") {
    return (
      <div className={SHELL_CLASS}>
        <p className="text-3xl font-semibold">Thanks for playing!</p>
        <p className="text-white/60">All draws for tonight are complete.</p>
      </div>
    )
  }

  if (phase === "reveal" && winner) {
    return (
      <div className={SHELL_CLASS}>
        <p className="text-lg uppercase tracking-widest text-white/50">Winner</p>
        <p className="text-6xl font-bold">{winner.name}</p>
        <p className="text-2xl text-white/70">{"••• ••• " + winner.phoneLast4}</p>
        <button
          type="button"
          onClick={onNextDraw}
          className="min-h-11 rounded-lg bg-[var(--brand,#b61616)] px-6 py-3 text-lg font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90"
        >
          Next draw
        </button>
      </div>
    )
  }

  if (phase === "between_draws") {
    return (
      <div className={SHELL_CLASS}>
        <p className="text-2xl font-semibold text-white/70">Getting the next draw ready&hellip;</p>
      </div>
    )
  }

  if (phase === "drawing") {
    return (
      <div className={SHELL_CLASS}>
        <RaffleDrawVideoOverlay />
        <p className="text-2xl font-semibold">Drawing&hellip;</p>
      </div>
    )
  }

  // waiting or ready
  return (
    <div className={SHELL_CLASS}>
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
    </div>
  )
}
