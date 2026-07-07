import React from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

export function KioskResolvingOverlay({ message }: { message?: string }) {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm"
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-center shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 sm:p-8">
      <svg
        className="mx-auto h-10 w-10 animate-spin text-[var(--brand,#b61616)]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <p className="mt-4 text-sm text-white/65">
        {message || "Hang tight — we\u2019re getting your payment ready."}
      </p>
      </div>
    </div>
  )
}

export function KioskDuplicatePurchaseOverlay({
  customerName,
  courseTitle,
  remainingCredits,
  hasConsecutiveOffer = false,
  autoDoneMs,
  onDone,
}: {
  customerName?: string
  courseTitle?: string
  remainingCredits?: number | null
  hasConsecutiveOffer?: boolean
  autoDoneMs?: number
  onDone: () => void
}) {
  React.useEffect(() => {
    if (!autoDoneMs || autoDoneMs <= 0) return
    const timeoutId = window.setTimeout(onDone, autoDoneMs)
    return () => window.clearTimeout(timeoutId)
  }, [autoDoneMs, onDone])

  return (
    <div
      aria-live="polite"
      aria-label="Already purchased"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="flex max-w-md flex-col items-center rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-center shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 sm:p-8">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <h2 className="mt-4 text-center text-2xl font-semibold text-white">Already checked in!</h2>
        <p className="mt-2 text-base text-white/70">
          {customerName ? `${customerName}, you` : "You"} are already checked in for{" "}
          <span className="font-medium text-white">{courseTitle || "this class"}</span>.
        </p>
        {typeof remainingCredits === "number" ? (
          <p className="mt-3 text-sm text-white/60">
            Credits remaining: <span className="font-semibold text-white/90">{remainingCredits}</span>
          </p>
        ) : null}
        {hasConsecutiveOffer ? (
          <p className="mt-3 text-sm text-emerald-200/80">
            We also have a special offer for your second class.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onDone}
          className="mt-6 w-full rounded-xl bg-white px-6 py-3 font-medium text-[#1a1d2e] transition-colors hover:bg-white/90"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function KioskPackageSuccessOverlay({
  remainingCredits,
  points,
  onDone,
}: {
  remainingCredits: number | null
  points: number
  onDone?: () => void
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Check-in complete"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="flex flex-col items-center rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
      <h2 className="mt-4 text-2xl font-semibold text-white text-center">You&apos;re all set!</h2>
      <p className="mt-2 text-base text-white/70 text-center">
        1 class was used from your package.
      </p>
      <div className="mt-4 flex flex-col items-center justify-center gap-1 text-sm text-white/60 text-center sm:flex-row sm:gap-4">
        {remainingCredits !== null && (
          <span>
            Credits remaining:{" "}
            <span className="font-semibold text-white/90">{remainingCredits}</span>
          </span>
        )}
        {points > 0 && (
          <span>
            Points earned:{" "}
            <span className="font-semibold text-emerald-400">+{points}</span>
          </span>
        )}
      </div>
      {onDone ? (
        <button
          type="button"
          onClick={onDone}
          className="mt-6 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Done
        </button>
      ) : null}
      </div>
    </div>
  )
}

/**
 * Terminal kiosk package check-in failure overlay — Retry + "please see the
 * front desk" guidance + an auto-reset timer, reusing
 * `KioskDuplicatePurchaseOverlay`'s `autoDoneMs` effect pattern. `onDone`
 * returns the kiosk to idle (`handleStationCompletion`); tapping Retry
 * unmounts this overlay (cancelling the pending `autoDoneMs` timer) before
 * the resolving overlay remounts and the auto-trigger effect re-enters.
 */
export function KioskPackageCheckInFailureOverlay({
  message,
  autoDoneMs,
  onDone,
  onRetry,
}: {
  message: string
  autoDoneMs?: number
  onDone: () => void
  onRetry: () => void
}) {
  React.useEffect(() => {
    if (!autoDoneMs || autoDoneMs <= 0) return
    const timeoutId = window.setTimeout(onDone, autoDoneMs)
    return () => window.clearTimeout(timeoutId)
  }, [autoDoneMs, onDone])

  return (
    <div
      aria-live="assertive"
      aria-label="Check-in failed"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="flex max-w-md flex-col items-center rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-center shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 sm:p-8">
        <AlertTriangle className="mx-auto h-14 w-14 text-amber-400" />
        <h2 className="mt-4 text-center text-2xl font-semibold text-white">We couldn&apos;t check you in</h2>
        <p className="mt-2 text-base text-white/70">{message}</p>
        <p className="mt-3 text-sm text-white/60">Please see the front desk for help.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 w-full rounded-xl bg-white px-6 py-3 font-medium text-[#1a1d2e] transition-colors hover:bg-white/90"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
