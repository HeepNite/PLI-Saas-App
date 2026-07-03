import React from "react"
import { buildKioskCheckoutQrImageUrl, type KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

type QuickRepeatOverlayProps = {
  bootstrap: BootstrapResponse
  /** QR checkout state — shown when paymentChannel is "card" */
  qrCheckout: KioskQrCheckoutState
  /** Called when customer confirms with cash or card */
  onConfirm: (paymentChannel: "cash" | "card", consecutiveAccepted: boolean) => void | Promise<void>
  /** Called when customer taps "Not today" */
  onDecline: () => void
  /** True while a confirm action is in-flight */
  isProcessing: boolean
  /** True after successful payment — shows success screen */
  success: boolean
  /** Which channel was used for the successful payment */
  successChannel?: "cash" | "card" | null
}

const formatDollars = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`

const format12h = (time24: string | null | undefined) => {
  if (!time24) return null
  const [h, m] = time24.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`
}

/**
 * Full-screen overlay that presents the Quick Repeat offer for returning students.
 * Shown when `bootstrap.quickRepeatEligible === true` before the regular enroll flow.
 */
export function KioskQuickRepeatOverlay({
  bootstrap,
  qrCheckout,
  onConfirm,
  onDecline,
  isProcessing,
  success,
  successChannel = null,
}: QuickRepeatOverlayProps) {
  const [promoDecided, setPromoDecided] = React.useState(false)
  const [promoAccepted, setPromoAccepted] = React.useState(false)

  const pattern = bootstrap.lastPurchasePattern
  const consecutiveOffer = bootstrap.consecutiveOffer ?? null
  const courseTitle = bootstrap.context.courseTitle
  const amountCents = pattern?.amount ?? 0
  const firstName = bootstrap.customer.firstName
  const hasPromo = Boolean(consecutiveOffer)
  const paymentEnabled = !hasPromo || promoDecided

  // When card QR checkout is active, render the QR panel within the overlay
  const isCardFlow = qrCheckout.phase !== "idle"
  const qrImage = qrCheckout.url ? buildKioskCheckoutQrImageUrl(qrCheckout.url) : null

  const handleCash = () => {
    if (isProcessing) return
    void onConfirm("cash", promoAccepted)
  }

  const handleCard = () => {
    if (isProcessing) return
    void onConfirm("card", promoAccepted)
  }

  return (
    <div
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label="Quick check-in offer"
    >
      <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 sm:p-8">

        {success ? (
          <div className="py-6 text-center" style={{ animation: "quickRepeatSlideIn 400ms ease-out" }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">You&apos;re all set{firstName ? `, ${firstName}` : ""}!</h2>
            {successChannel === "cash" ? (
              <p className="mt-3 text-lg font-semibold text-amber-400">Remember to pay at the front desk.</p>
            ) : (
              <p className="mt-3 text-lg font-semibold text-emerald-400">Payment confirmed!</p>
            )}
            <p className="mt-1 text-sm text-white/50">Enjoy your class today.</p>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Quick check-in</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            Same as always{firstName ? `, ${firstName}` : ""}!
          </h2>
          <p className="mt-3 flex items-baseline justify-center gap-2 text-lg leading-snug">
            <span className="font-semibold text-[var(--brand,#b61616)]">{courseTitle}</span>
            {amountCents > 0 ? (
              <span className="font-bold text-emerald-400">{formatDollars(amountCents)}</span>
            ) : null}
          </p>
        </div>

        {/* Consecutive offer card — before decision */}
        {consecutiveOffer && !isCardFlow && !promoDecided && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/55">Add second class promotion</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    PROMO
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-white leading-snug">{consecutiveOffer.linkedCourseTitle}</p>
                {format12h(consecutiveOffer.linkedCourseTime) ? (
                  <p className="mt-0.5 text-xs text-white/55">
                    {format12h(consecutiveOffer.linkedCourseTime)}
                  </p>
                ) : null}
              </div>
              {consecutiveOffer.dropInConsecutiveCents != null && (
                <div className="flex-shrink-0 text-right">
                  {consecutiveOffer.regularDropInCents != null && consecutiveOffer.regularDropInCents > consecutiveOffer.dropInConsecutiveCents && (
                    <p className="text-xs text-red-400 line-through leading-none">
                      {formatDollars(consecutiveOffer.regularDropInCents)}
                    </p>
                  )}
                  <p className="text-base font-bold text-white leading-snug">
                    {formatDollars(consecutiveOffer.dropInConsecutiveCents)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { setPromoAccepted(true); setPromoDecided(true) }}
                className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-400"
              >
                {consecutiveOffer.dropInConsecutiveCents != null
                  ? `Add +${formatDollars(consecutiveOffer.dropInConsecutiveCents)}`
                  : "Add class"}
              </button>
              <button
                type="button"
                onClick={() => { setPromoAccepted(false); setPromoDecided(true) }}
                className="flex-1 rounded-lg border border-red-400/30 bg-transparent py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {/* Checkout summary — after promo decision */}
        {!isCardFlow && promoDecided && (
          <div
            className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"
            style={{ animation: "quickRepeatSlideIn 400ms ease-out" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-white/55">Order summary</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/80">{courseTitle}</span>
                <span className="text-sm font-semibold text-white">{formatDollars(amountCents)}</span>
              </div>
              {promoAccepted && consecutiveOffer?.dropInConsecutiveCents != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">
                    {consecutiveOffer.linkedCourseTitle}
                    <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">promo</span>
                  </span>
                  <span className="text-sm font-semibold text-white">{formatDollars(consecutiveOffer.dropInConsecutiveCents)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-lg font-bold text-emerald-400">
                  {formatDollars(amountCents + (promoAccepted && consecutiveOffer?.dropInConsecutiveCents != null ? consecutiveOffer.dropInConsecutiveCents : 0))}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setPromoDecided(false); setPromoAccepted(false) }}
              className="mt-2 text-xs text-white/40 underline underline-offset-2 transition hover:text-white/70"
            >
              change promo
            </button>
          </div>
        )}

        {/* Card QR panel (shown after card is chosen) */}
        {isCardFlow && (
          <div className="mt-5 space-y-4 text-center">
            <p className="text-sm text-white/70">
              {qrCheckout.phase === "creating" && "Preparing your QR checkout…"}
              {qrCheckout.phase === "qr_ready" && "Scan this QR code with your phone to pay."}
              {qrCheckout.phase === "waiting_for_payment" && "Waiting for payment confirmation…"}
              {qrCheckout.phase === "expired" && "QR code expired. Please try again."}
              {qrCheckout.phase === "error" && (qrCheckout.error || "Unable to start QR checkout.")}
            </p>
            <div className="flex justify-center">
              {qrImage ? (
                <div className="rounded-[1.25rem] bg-white p-4 shadow-[0_18px_50px_-24px_rgba(255,255,255,0.35)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImage} alt="Card checkout QR" className="h-44 w-44 object-contain" />
                </div>
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-[1.25rem] border border-dashed border-white/18 bg-white/5 text-sm text-white/55">
                  {qrCheckout.phase === "creating" ? (
                    <svg className="h-8 w-8 animate-spin text-white/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    "QR code will appear here."
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment buttons — hidden until promo is decided, slide in with animation */}
        {!isCardFlow && (
          <div
            className={`grid transition-all duration-500 ease-out ${
              paymentEnabled
                ? "mt-6 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCash}
                  disabled={isProcessing || !paymentEnabled}
                  className="flex-1 rounded-xl bg-[var(--brand,#b61616)] px-6 py-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Pay Cash
                </button>
                <button
                  type="button"
                  onClick={handleCard}
                  disabled={isProcessing || !paymentEnabled}
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Pay by Card
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Decline */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onDecline}
            disabled={isProcessing}
            className="text-sm text-white/45 underline-offset-2 transition hover:text-white/70 hover:underline disabled:pointer-events-none"
          >
            Not today
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
