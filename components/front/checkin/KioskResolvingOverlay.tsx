import { CheckCircle2 } from "lucide-react"

export function KioskResolvingOverlay({ message }: { message?: string }) {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-[#13141d]"
    >
      <svg
        className="h-10 w-10 animate-spin text-[var(--brand,#b61616)]"
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
        {message || "Alright niños, hang tight — we\u2019re getting your payment ready."}
      </p>
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
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-[#13141d] px-4 text-center"
    >
      <CheckCircle2 className="h-14 w-14 text-emerald-400" />
      <h2 className="mt-4 text-2xl font-semibold text-white">You&apos;re all set!</h2>
      <p className="mt-2 text-base text-white/70">Enjoy your class.</p>
      <div className="mt-4 flex items-center gap-4 text-sm text-white/50">
        {remainingCredits !== null && (
          <span>Credits remaining: <span className="font-semibold text-white/80">{remainingCredits}</span></span>
        )}
        {points > 0 && (
          <span>Points earned: <span className="font-semibold text-emerald-400">+{points}</span></span>
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
  )
}
