export function LatePaymentPanel({
  courseTitle,
  date,
  time,
  qrImage,
  onUseTablet,
  onOpenPhone,
}: {
  courseTitle: string
  date: string
  time: string
  qrImage: string
  onUseTablet: () => void
  onOpenPhone: () => void
}) {
  return (
    <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/5 px-4 py-4">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Previous class pending</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {courseTitle}
          </h3>
          <p className="mt-2 text-sm text-white/72">
            {date} {time}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/68">
            Regular check-in has already closed for this class. If the student arrived late or prefers to pay at the end,
            they can scan this QR or use this same tablet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUseTablet}
              className="rounded-xl border border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.18)] px-4 py-2 text-sm font-semibold text-white"
            >
              Pay on this tablet
            </button>
            <button
              type="button"
              onClick={onOpenPhone}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/82"
            >
              Open on phone
            </button>
          </div>
        </div>
        <div className="mx-auto text-center lg:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImage}
            alt="Late payment QR"
            className="h-40 w-40 rounded-2xl border border-white/15 bg-white object-contain"
          />
          <p className="mt-3 max-w-[11rem] text-sm text-white/72">
            Scan this QR to pay for the previous class from your phone.
          </p>
        </div>
      </div>
    </div>
  )
}
