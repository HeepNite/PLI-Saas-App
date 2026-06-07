import React from "react"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import { buildKioskCheckoutQrImageUrl } from "@/lib/checkin/kiosk-qr-payment"

type KioskQrPaymentPanelProps = {
  checkoutState: KioskQrCheckoutState
  onCancel: () => void
  onRetry: () => void
}

const getHeading = (state: KioskQrCheckoutState) => {
  switch (state.phase) {
    case "creating":
      return "Preparing QR checkout"
    case "qr_ready":
      return "Scan to pay"
    case "waiting_for_payment":
      return state.awaitingWebhook ? "Confirming payment" : "Waiting for payment"
    case "expired":
      return "QR code expired"
    case "error":
      return "Unable to start QR checkout"
    default:
      return "Card payment"
  }
}

const getBody = (state: KioskQrCheckoutState) => {
  switch (state.phase) {
    case "creating":
      return "We are creating a secure hosted checkout session for this customer."
    case "qr_ready":
      return "Ask the customer to scan this QR code with their phone to open the card payment page."
    case "waiting_for_payment":
      return state.awaitingWebhook
        ? "The customer completed Stripe Checkout. We are waiting for the durable purchase record before showing success."
        : "The QR code is active. We will keep polling until the payment completes or the session expires."
    case "expired":
      return "This checkout session is no longer valid. Create a new QR code to continue."
    case "error":
      return state.error || "We could not create the checkout session. Try again."
    default:
      return null
  }
}

export default function KioskQrPaymentPanel({ checkoutState, onCancel, onRetry }: KioskQrPaymentPanelProps) {
  const qrImage = checkoutState.url ? buildKioskCheckoutQrImageUrl(checkoutState.url) : null
  const heading = getHeading(checkoutState)
  const body = getBody(checkoutState)

  return (
    <div className="fixed inset-0 z-[10012] flex items-center justify-center bg-black/75 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-6">
      <button
        type="button"
        aria-label="Close QR overlay"
        onClick={onCancel}
        className="absolute inset-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Card payment QR"
        className="relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[linear-gradient(165deg,rgba(9,13,24,0.98),rgba(24,31,49,0.96))] px-5 pb-6 pt-5 text-white shadow-[0_32px_90px_-42px_rgba(0,0,0,0.9)] sm:max-w-lg sm:px-6 sm:pb-7 sm:pt-6"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white sm:right-4 sm:top-4"
          aria-label="Close QR"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
        </button>

        <div className="space-y-5 text-center sm:space-y-6">
          <div className="space-y-3 px-10 sm:px-12">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Hosted checkout</p>
            <h4 className="text-xl font-semibold leading-tight sm:text-[1.75rem]">{heading}</h4>
            {body && <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/72">{body}</p>}
          </div>

          <div className="flex justify-center">
            {qrImage ? (
              <div className="rounded-[1.45rem] bg-white p-4 shadow-[0_18px_50px_-24px_rgba(255,255,255,0.35)] sm:p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImage}
                  alt="Hosted checkout QR"
                  className="h-44 w-44 object-contain sm:h-48 sm:w-48"
                />
              </div>
            ) : (
              <div className="flex h-44 w-44 items-center justify-center rounded-[1.45rem] border border-dashed border-white/18 bg-white/5 px-6 text-center text-sm text-white/65 sm:h-48 sm:w-48">
                QR code will appear here once the session is ready.
              </div>
            )}
          </div>

          <div className="mx-auto max-w-xs pb-1">
            <p className="text-sm leading-relaxed text-white/62">
              Every purchase earns points and stays available to review in the student account.
            </p>
          </div>
        </div>

        {(checkoutState.phase === "expired" || checkoutState.phase === "error") && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
            >
              Create new QR
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/18 px-4 py-2 text-sm text-white"
            >
              Close QR
            </button>
          </div>
        )}

        {(checkoutState.phase === "creating" || checkoutState.phase === "qr_ready" || checkoutState.phase === "waiting_for_payment") && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/18 px-4 py-2 text-sm text-white"
            >
              Cancel QR
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
