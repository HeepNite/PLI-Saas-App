import { CheckCircle2 } from "lucide-react"

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
        {message || "Alright niños, hang tight — we\u2019re getting your payment ready."}
      </p>
      </div>
    </div>
  )
}

export function KioskDuplicatePurchaseOverlay({
  customerName,
  courseTitle,
  onDone,
}: {
  customerName?: string
  courseTitle?: string
  onDone: () => void
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Already purchased"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8 max-w-md">
        <CheckCircle2 className="h-14 w-14 text-emerald-400" />
        <h2 className="mt-4 text-2xl font-semibold text-white">Already purchased!</h2>
        <p className="mt-2 text-base text-white/70">
          {customerName ? `${customerName}, you` : "You"} already have a purchase for{" "}
          <span className="font-medium text-white">{courseTitle || "this class"}</span> on this date and time.
        </p>
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
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8">
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
    </div>
  )
}
