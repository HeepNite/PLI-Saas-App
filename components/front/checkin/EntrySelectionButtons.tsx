import { KeyRound, UserPlus } from "lucide-react"

export function EntrySelectionButtons({
  mode,
  isKioskTerminalFlow,
  onExisting,
  onNew,
  variant = "standalone",
}: {
  mode: "idle" | "existing" | "new"
  isKioskTerminalFlow: boolean
  onExisting: () => void
  onNew: () => void
  variant?: "standalone" | "embedded"
}) {
  const isEmbedded = variant === "embedded"

  return (
    <div className={isEmbedded ? "grid grid-cols-1 gap-4" : "mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"}>
      <button
        type="button"
        onClick={onExisting}
        className={`${isEmbedded ? "min-h-[108px] rounded-2xl px-5 py-4" : "min-h-[80px] rounded-2xl px-4 py-3 sm:min-h-[88px] sm:px-5 sm:py-3"} border text-left transition-colors ${
          mode === "existing"
            ? "border-[rgba(182,22,22,0.55)] bg-[rgba(182,22,22,0.12)] text-white shadow-[0_0_0_1px_rgba(182,22,22,0.16)]"
            : "border-white/15 bg-black/20 text-white/80 hover:border-white/25 hover:bg-white/[0.06]"
        }`}
      >
        <div className="flex items-start gap-3">
          {isEmbedded && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/75">
              <KeyRound className="h-4 w-4" />
            </span>
          )}
          <span>
            <p className={isEmbedded ? "text-base font-semibold" : "text-sm font-semibold"}>I am already a customer</p>
            <p className={`${isEmbedded ? "mt-1.5" : "mt-1"} text-xs text-white/60`}>
              {isKioskTerminalFlow ? "Enter your PIN to continue on this terminal." : "Sign in and repurchase the current course."}
            </p>
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={onNew}
        className={`${isEmbedded ? "min-h-[108px] rounded-2xl px-5 py-4" : "min-h-[80px] rounded-2xl px-4 py-3 sm:min-h-[88px] sm:px-5 sm:py-3"} border text-left transition-colors ${
          mode === "new"
            ? "border-[rgba(182,22,22,0.55)] bg-[rgba(182,22,22,0.12)] text-white shadow-[0_0_0_1px_rgba(182,22,22,0.16)]"
            : "border-white/15 bg-black/20 text-white/80 hover:border-white/25 hover:bg-white/[0.06]"
        }`}
      >
        <div className="flex items-start gap-3">
          {isEmbedded && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/75">
              <UserPlus className="h-4 w-4" />
            </span>
          )}
          <span>
            <p className={isEmbedded ? "text-base font-semibold" : "text-sm font-semibold"}>I am new</p>
            <p className={`${isEmbedded ? "mt-1.5" : "mt-1"} text-xs text-white/60`}>Open regular purchase with account creation included.</p>
          </span>
        </div>
      </button>
    </div>
  )
}
