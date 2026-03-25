import React from "react"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import { buildKioskCheckoutQrImageUrl } from "@/lib/checkin/kiosk-qr-payment"

type KioskQrPaymentPanelProps = {
  checkoutState: KioskQrCheckoutState
  onCancel: () => void
  onRetry: () => void
}

const formatExpiry = (value: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
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
  const expiresAtLabel = formatExpiry(checkoutState.expiresAt)
  const heading = getHeading(checkoutState)
  const body = getBody(checkoutState)

  return (
    <div className="fixed inset-0 z-[10012] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm sm:px-6">
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
        className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-white/10 bg-[linear-gradient(165deg,rgba(9,13,24,0.98),rgba(24,31,49,0.96))] p-5 text-white shadow-[0_32px_90px_-42px_rgba(0,0,0,0.9)] sm:p-6"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Close QR"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
        </button>

        <div className="space-y-5 text-center">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Hosted checkout</p>
            <h4 className="text-2xl font-semibold leading-tight sm:text-[2rem]">{heading}</h4>
            {body && <p className="mx-auto max-w-md text-sm leading-relaxed text-white/72 sm:text-base">{body}</p>}
            {expiresAtLabel && isFinite(new Date(checkoutState.expiresAt || "").getTime()) && (
              <p className="text-xs text-white/55">Expires {expiresAtLabel}</p>
            )}
          </div>

          <div className="flex justify-center">
            {qrImage ? (
              <div className="rounded-[1.5rem] bg-white p-4 shadow-[0_18px_50px_-24px_rgba(255,255,255,0.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImage}
                  alt="Hosted checkout QR"
                  className="h-64 w-64 object-contain sm:h-72 sm:w-72"
                />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-[1.5rem] border border-dashed border-white/18 bg-white/5 px-6 text-center text-sm text-white/65 sm:h-72 sm:w-72">
                QR code will appear here once the session is ready.
              </div>
            )}
          </div>

          <div className="space-y-2">
            {checkoutState.url && (
              <a
                href={checkoutState.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-medium text-white underline underline-offset-4"
              >
                Open checkout link
              </a>
            )}
            {checkoutState.sessionId && (
              <p className="text-xs text-white/45">Session: {checkoutState.sessionId}</p>
            )}
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
