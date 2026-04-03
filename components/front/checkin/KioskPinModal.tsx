import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"

export function KioskPinModal({
  title,
  description,
  onClose,
  hasSession,
  entryPin,
  entryRevealedIndex,
  entryActiveSlot,
  isEntryActive,
  attemptsRemaining,
  blockedUntilLabel,
  onIdentify,
  canIdentify,
  isIdentifying,
  nextPin,
  nextRevealedIndex,
  nextActiveSlot,
  isNextActive,
  confirmPin,
  confirmRevealedIndex,
  confirmActiveSlot,
  isConfirmActive,
  onRotate,
  canRotate,
  isRotating,
  onDigit,
  onBackspace,
  onClear,
  isKeypadDisabled,
  visibleError,
  success,
}: {
  title: string
  description: string
  onClose: () => void
  hasSession: boolean
  entryPin: string
  entryRevealedIndex: number | null
  entryActiveSlot: number
  isEntryActive: boolean
  attemptsRemaining?: number | null
  blockedUntilLabel?: string | null
  onIdentify: () => void
  canIdentify: boolean
  isIdentifying: boolean
  nextPin: string
  nextRevealedIndex: number | null
  nextActiveSlot: number
  isNextActive: boolean
  confirmPin: string
  confirmRevealedIndex: number | null
  confirmActiveSlot: number
  isConfirmActive: boolean
  onRotate: () => void
  canRotate: boolean
  isRotating: boolean
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  isKeypadDisabled: boolean
  visibleError: string | null
  success: string | null
}) {
  return (
    <div className="fixed inset-0 z-[12000] flex items-start justify-center bg-black/72 px-4 pb-4 pt-24 backdrop-blur-sm sm:px-6 sm:pb-5 sm:pt-28 md:pb-6 md:pt-32 lg:items-center lg:pt-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="existing-customer-pin-title"
        className="max-h-[calc(100vh-6rem)] w-full max-w-[34rem] overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 md:max-w-[52rem]"
      >
        <div className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%,transparent_72%,rgba(0,0,0,0.24))]" />
          <div className="relative z-10 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/12 bg-white/[0.035] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/72 transition hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="relative z-10 mt-3 grid items-center gap-5 md:grid-cols-[minmax(0,1.08fr)_1px_minmax(18rem,0.88fr)] md:gap-0 lg:grid-cols-[minmax(0,1.14fr)_1px_minmax(19rem,0.9fr)]">
            <div
              className="relative flex h-full flex-col justify-center overflow-hidden rounded-[1.5rem] bg-transparent p-5 text-white sm:p-6 md:pr-5 md:pl-6 md:py-7 lg:pr-6"
            >
              <div>
                <h2
                  id="existing-customer-pin-title"
                  className="max-w-[24rem] text-[1.55rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[1.75rem] md:text-[1.9rem] md:whitespace-nowrap"
                >
                  {title}
                </h2>
                <div className="mt-3 h-[0.2rem] w-[5rem] rounded-full bg-[var(--brand,#b61616)]" />
                <p
                  className="mt-3 max-w-none text-sm leading-6 text-white/68 sm:text-[0.95rem]"
                >
                  {description}
                </p>
              </div>

              {!hasSession ? (
                <>
                  <div className="mt-5">
                    <PinSlots
                      value={entryPin}
                      revealedIndex={entryRevealedIndex}
                      isActive={isEntryActive}
                      activeIndex={entryActiveSlot}
                    />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/48">
                    The highlighted slot shows where the next digit will land.
                  </p>
                  {typeof attemptsRemaining === "number" && attemptsRemaining >= 0 && (
                    <p className="mt-4 text-xs text-white/58">Attempts remaining on this terminal: {attemptsRemaining}</p>
                  )}
                  {blockedUntilLabel && (
                    <p className="mt-2 text-xs text-amber-200/90">{blockedUntilLabel}</p>
                  )}
                  <button
                    type="button"
                    onClick={onIdentify}
                    disabled={!canIdentify}
                    className="mt-5 w-full rounded-xl bg-[var(--brand,#b61616)] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong,#991010)] disabled:opacity-50"
                  >
                    {isIdentifying ? "Checking PIN..." : "Continue"}
                  </button>
                  {visibleError ? <p className="mt-3 text-sm text-red-200">{visibleError}</p> : null}
                  {success ? <p className="mt-3 text-sm text-emerald-200">{success}</p> : null}
                </>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/46">NEW PIN</p>
                      <PinSlots
                        value={nextPin}
                        revealedIndex={nextRevealedIndex}
                        isActive={isNextActive}
                        activeIndex={nextActiveSlot}
                        compact
                        grouped
                      />
                    </div>
                    <div>
                      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/46">CONFIRM PIN</p>
                      <PinSlots
                        value={confirmPin}
                        revealedIndex={confirmRevealedIndex}
                        isActive={isConfirmActive}
                        activeIndex={confirmActiveSlot}
                        compact
                        grouped
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRotate}
                    disabled={!canRotate}
                    className="mt-5 w-full rounded-[1rem] bg-[linear-gradient(180deg,#d23838,#9f1515)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_32px_-22px_rgba(210,52,52,0.85)] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {isRotating ? "Saving PIN..." : "Save new PIN"}
                  </button>
                  {visibleError ? <p className="mt-3 text-sm text-[#ff8a8a]">{visibleError}</p> : null}
                  {success ? <p className="mt-3 text-sm text-[#71e39b]">{success}</p> : null}
                </>
              )}
            </div>

            <div className="hidden h-[72%] w-px self-center rounded-full bg-transparent md:block" aria-hidden="true" />

            <div className="w-full self-stretch p-3 sm:p-4 md:pl-5 md:pr-4 md:py-4 lg:pl-6 lg:pr-5 lg:py-5">
              <div className="flex h-full w-full self-center rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(182,22,22,0.14),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 sm:p-[1.125rem] md:items-center md:justify-center">
                <KioskNumericKeypad
                  className="mx-auto w-full max-w-[17.25rem]"
                  disabled={isKeypadDisabled}
                  framed={false}
                  size="modal"
                  onDigit={onDigit}
                  onBackspace={onBackspace}
                  onClear={onClear}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PinSlots({
  value,
  revealedIndex,
  isActive,
  activeIndex,
  compact,
  grouped,
}: {
  value: string
  revealedIndex: number | null
  isActive: boolean
  activeIndex: number
  compact?: boolean
  grouped?: boolean
}) {
  return (
    <div
      className={grouped
        ? "grid h-12 grid-cols-4 overflow-hidden rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,28,0.96),rgba(10,12,20,0.98))] shadow-[0_24px_44px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/5"
        : `grid grid-cols-4 gap-2.5 ${compact ? "sm:gap-3" : "sm:gap-[1.125rem]"}`}
    >
      {Array.from({ length: 4 }, (_, index) => {
        const hasDigit = index < value.length
        const isSlotActive = isActive && index === activeIndex
        const displayValue = hasDigit ? (revealedIndex === index ? value[index] : "*") : ""

        return (
          <div
            key={`pin-slot-${index}`}
            className={grouped
              ? `relative flex items-center justify-center text-center font-semibold text-white transition ${
                  compact
                    ? "h-12 text-lg tracking-[0.22em] sm:text-[1.15rem]"
                    : "h-[5rem] text-[2rem] tracking-[0.32em] sm:h-[5.75rem] sm:text-[2.4rem]"
                } ${index > 0 ? "border-l border-white/8" : ""} ${
                  isSlotActive
                    ? "bg-[linear-gradient(180deg,rgba(38,44,60,0.98),rgba(22,26,38,0.98))] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.03)]"
                    : "bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]"
                }`
              : `flex items-center justify-center rounded-2xl border text-center font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition ${
                  compact
                    ? "h-14 text-xl tracking-[0.24em] sm:h-16 sm:text-2xl"
                    : "h-16 text-[1.9rem] tracking-[0.3em] sm:h-20 sm:text-[2.4rem]"
                } ${
                  isSlotActive
                    ? "border-white/40 bg-white/[0.1] shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
                    : "border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]"
                }`}
            aria-hidden="true"
          >
            {displayValue ? (
              <span>{displayValue}</span>
            ) : isSlotActive ? (
              <span className={grouped ? "h-7 w-px animate-pulse rounded-full bg-white/90" : "h-6 w-px animate-pulse rounded-full bg-white"} />
            ) : (
              <span className={grouped ? "text-white/22" : "text-white/28"}>-</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
