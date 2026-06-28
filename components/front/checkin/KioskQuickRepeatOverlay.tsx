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
}

const formatDollars = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`

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
}: QuickRepeatOverlayProps) {
  const [consecutiveAccepted, setConsecutiveAccepted] = React.useState(false)

  const pattern = bootstrap.lastPurchasePattern
  const consecutiveOffer = bootstrap.consecutiveOffer ?? null
  const courseTitle = bootstrap.context.courseTitle
  const amountCents = pattern?.amount ?? 0
  const firstName = bootstrap.customer.firstName

  // When card QR checkout is active, render the QR panel within the overlay
  const isCardFlow = qrCheckout.phase !== "idle"
  const qrImage = qrCheckout.url ? buildKioskCheckoutQrImageUrl(qrCheckout.url) : null

  const handleCash = () => {
    if (isProcessing) return
    void onConfirm("cash", consecutiveAccepted)
  }

  const handleCard = () => {
    if (isProcessing) return
    void onConfirm("card", consecutiveAccepted)
  }

  return (
    <div
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label="Quick check-in offer"
    >
      <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 sm:p-8">

        {/* Header */}
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Quick check-in</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            Welcome back{firstName ? `, ${firstName}` : ""}!
          </h2>
          <p className="mt-2 text-base text-white/70">
            Joining{" "}
            <span className="font-medium text-white">{courseTitle}</span>
            {amountCents > 0 ? (
              <>
                {" "}for{" "}
                <span className="font-semibold text-white">{formatDollars(amountCents)}</span>
              </>
            ) : null}
          </p>
        </div>

        {/* Consecutive offer toggle */}
        {consecutiveOffer && !isCardFlow && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">
              Add{" "}
              <span className="text-white/90">{consecutiveOffer.linkedCourseTitle}</span>
              {consecutiveOffer.dropInConsecutiveCents != null ? (
                <span className="ml-1 text-emerald-300">
                  +{formatDollars(consecutiveOffer.dropInConsecutiveCents)}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-white/55">Consecutive class discount</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConsecutiveAccepted(true)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
                  consecutiveAccepted
                    ? "bg-emerald-500 text-white shadow-md"
                    : "border border-white/15 bg-white/8 text-white/80 hover:bg-white/12"
                }`}
              >
                Yes, add it
              </button>
              <button
                type="button"
                onClick={() => setConsecutiveAccepted(false)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
                  !consecutiveAccepted
                    ? "bg-white/15 text-white"
                    : "border border-white/15 bg-transparent text-white/55 hover:bg-white/8"
                }`}
              >
                No thanks
              </button>
            </div>
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

        {/* Payment buttons */}
        {!isCardFlow && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCash}
              disabled={isProcessing}
              className="flex-1 rounded-xl bg-white px-6 py-4 text-base font-semibold text-[#1a1d2e] transition hover:bg-white/90 disabled:opacity-50"
            >
              Pay Cash
            </button>
            <button
              type="button"
              onClick={handleCard}
              disabled={isProcessing}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              Pay by Card
            </button>
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
      </div>
    </div>
  )
}
