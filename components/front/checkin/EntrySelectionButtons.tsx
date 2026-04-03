export function EntrySelectionButtons({
  mode,
  isKioskTerminalFlow,
  onExisting,
  onNew,
}: {
  mode: "idle" | "existing" | "new"
  isKioskTerminalFlow: boolean
  onExisting: () => void
  onNew: () => void
}) {
  return (
    <div className="mx-auto mt-5 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <button
        type="button"
        onClick={onExisting}
        className={`min-h-[104px] rounded-2xl border px-4 py-4 text-left sm:min-h-[112px] sm:px-5 sm:py-5 ${
          mode === "existing"
            ? "border-[rgba(182,22,22,0.55)] bg-[rgba(182,22,22,0.12)] text-white shadow-[0_0_0_1px_rgba(182,22,22,0.16)]"
            : "border-white/15 bg-black/20 text-white/80"
        }`}
      >
        <p className="text-sm font-semibold">I am already a customer</p>
        <p className="mt-1 text-xs text-white/60">
          {isKioskTerminalFlow ? "Enter your PIN to continue on this terminal." : "Sign in and repurchase the current course."}
        </p>
      </button>
      <button
        type="button"
        onClick={onNew}
        className={`min-h-[104px] rounded-2xl border px-4 py-4 text-left sm:min-h-[112px] sm:px-5 sm:py-5 ${
          mode === "new"
            ? "border-[rgba(182,22,22,0.55)] bg-[rgba(182,22,22,0.12)] text-white shadow-[0_0_0_1px_rgba(182,22,22,0.16)]"
            : "border-white/15 bg-black/20 text-white/80"
        }`}
      >
        <p className="text-sm font-semibold">I am new</p>
        <p className="mt-1 text-xs text-white/60">Open regular purchase with account creation included.</p>
      </button>
    </div>
  )
}
