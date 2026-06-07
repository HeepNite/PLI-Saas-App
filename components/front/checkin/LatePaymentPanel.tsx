/**
 * Design tokens for kiosk terminal layout
 * Shared with CourseCardPanel for visual consistency
 */
const KIOSK_TOKENS = {
  gridColumns: "minmax(0, 0.68fr) minmax(15rem, 0.72fr) minmax(12.5rem, 0.5fr)",
  gap: "0.75rem",
} as const

function ColumnDivider({ side }: { side: "left" }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute ${side === "left" ? "left-0" : "right-0"} top-0 h-full w-px bg-gradient-to-b from-transparent via-white/12 to-transparent`}
    />
  )
}

function ActionSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full flex-col px-4 py-1">
      <ColumnDivider side="left" />
      <p className="mb-5 text-center text-xs uppercase tracking-[0.2em] text-white/55">
        Continue here
      </p>
      <div className="flex min-h-[238px] flex-col justify-center">{children}</div>
    </div>
  )
}

export function LatePaymentPanel({
  courseTitle,
  date,
  time,
  qrImage,
  onUseTablet,
  onOpenPhone,
  onExistingCustomer,
  onNewCustomer,
}: {
  courseTitle: string
  date: string
  time: string
  qrImage: string
  onUseTablet: () => void
  onOpenPhone: () => void
  onExistingCustomer?: () => void
  onNewCustomer?: () => void
}) {
  return (
    <div className="mx-[1.25rem] mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4 lg:p-5">
      {/* Eyebrow labels row — perfectly aligned */}
      <div
        className="grid"
        style={{ gridTemplateColumns: KIOSK_TOKENS.gridColumns, gap: KIOSK_TOKENS.gap }}
      >
        <p className="pr-4 text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
          Previous class pending
        </p>
        <p className="relative px-4 text-center text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
          <span className="absolute left-0 top-[-16px] bottom-[-12px] w-px bg-gradient-to-b from-transparent via-amber-300/20 to-transparent" />
          Pay for this class
        </p>
        <p className="relative pl-4 text-center text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
          <span className="absolute left-0 top-[-16px] bottom-[-12px] w-px bg-gradient-to-b from-transparent via-amber-300/20 to-transparent" />
          QR Code
        </p>
      </div>

      {/* Content row — aligned below labels */}
      <div
        className="mt-3 grid items-center"
        style={{ gridTemplateColumns: KIOSK_TOKENS.gridColumns, gap: KIOSK_TOKENS.gap }}
      >
        {/* Column 1: Course Info */}
        <div className="pr-4">
          <h3 className="text-lg font-semibold text-white">{courseTitle}</h3>
          <p className="mt-1 text-sm text-white/75">
            {date} {time}
          </p>
          <p className="mt-2 text-xs text-white/55">
            Scan this code to pay for the previous class
          </p>
        </div>

        {/* Column 2: Action buttons */}
        <div className="relative flex flex-col gap-3 px-4">
          <span className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-300/20 to-transparent" />

          {onExistingCustomer && (
            <button
              type="button"
              onClick={onExistingCustomer}
              className="w-full rounded-xl border border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.18)] px-4 py-3 text-left"
            >
              <span className="block text-sm font-semibold text-white">I am already a customer</span>
              <span className="block text-xs text-white/60">Enter your PIN to continue</span>
            </button>
          )}

          {onNewCustomer && (
            <button
              type="button"
              onClick={onNewCustomer}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left"
            >
              <span className="block text-sm font-semibold text-white">I am new</span>
              <span className="block text-xs text-white/60">Open regular purchase</span>
            </button>
          )}
        </div>

        {/* Column 3: QR Code */}
        <div className="relative flex justify-center pl-4">
          <span className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-300/20 to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImage}
            alt="Late payment QR"
            className="h-32 w-32 rounded-xl border border-white/15 bg-white object-contain"
          />
        </div>
      </div>
    </div>
  )
}
