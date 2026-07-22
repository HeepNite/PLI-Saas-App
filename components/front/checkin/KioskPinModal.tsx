import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import type { KioskPinThrottleSeverity } from "@/lib/security/kiosk-pin-throttle"

/** Format a raw 10-digit string as (XXX) XXX-XXXX */
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10)
  if (digits.length <= 3) return digits.length ? `(${digits}` : ""
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function KioskPinModal({
  title,
  description,
  onClose,
  phone,
  onPhoneIdentify,
  isPhoneIdentifying,
  attemptsRemaining,
  throttleSeverity,
  blockedUntilLabel,
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
  /** Raw digits for phone identification */
  phone: string
  onPhoneIdentify: () => void
  isPhoneIdentifying: boolean
  attemptsRemaining?: number | null
  throttleSeverity?: KioskPinThrottleSeverity | null
  blockedUntilLabel?: string | null
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

              <>
                <div className="mt-5">
                  <PhoneDisplay value={phone} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/48">
                  Enter your 10-digit US phone number.
                </p>
                {typeof attemptsRemaining === "number" && attemptsRemaining >= 0 && (
                  <p className="mt-4 text-xs text-white/58">
                    {throttleSeverity === "warning" || throttleSeverity === "cooldown"
                      ? `Attempts before staff assistance is recommended: ${attemptsRemaining}`
                      : `Attempts remaining on this terminal: ${attemptsRemaining}`}
                  </p>
                )}
                {blockedUntilLabel && (
                  <p className="mt-2 text-xs text-amber-200/90">{blockedUntilLabel}</p>
                )}
                <button
                  type="button"
                  onClick={onPhoneIdentify}
                  disabled={isPhoneIdentifying || phone.replace(/\D/g, "").length < 10}
                  className="mt-5 w-full rounded-xl bg-[var(--brand,#b61616)] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong,#991010)] disabled:opacity-50"
                >
                  {isPhoneIdentifying ? "Verifying..." : "Continue"}
                </button>
                {visibleError ? <p className="mt-3 text-sm text-red-200">{visibleError}</p> : null}
                {success ? <p className="mt-3 text-sm text-emerald-200">{success}</p> : null}
              </>
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

function PhoneDisplay({ value }: { value: string }) {
  const formatted = formatPhoneDisplay(value)
  const isEmpty = value.replace(/\D/g, "").length === 0
  return (
    <div className="flex h-[4.5rem] items-center rounded-[1.25rem] border border-white/12 bg-[linear-gradient(180deg,rgba(15,18,28,0.96),rgba(10,12,20,0.98))] px-5 shadow-[0_24px_44px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/5">
      <span
        className={`flex-1 text-[1.75rem] font-semibold tracking-[0.06em] transition ${
          isEmpty ? "text-white/28" : "text-white"
        }`}
        aria-live="polite"
      >
        {isEmpty ? "(___) ___-____" : formatted}
      </span>
      {!isEmpty && (
        <span className="ml-2 h-7 w-px animate-pulse rounded-full bg-white/80" aria-hidden="true" />
      )}
    </div>
  )
}
