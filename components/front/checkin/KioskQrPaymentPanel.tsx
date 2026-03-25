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
    <div className="rounded-[1.5rem] border border-black/10 bg-[linear-gradient(160deg,rgba(17,24,39,0.98),rgba(31,41,55,0.96))] p-5 text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.75)] dark:border-white/10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Hosted checkout</p>
          <h4 className="text-xl font-semibold leading-tight">{heading}</h4>
          {body && <p className="text-sm leading-relaxed text-white/72">{body}</p>}
          {checkoutState.sessionId && (
            <p className="text-xs text-white/55">Session: {checkoutState.sessionId}</p>
          )}
          {expiresAtLabel && isFinite(new Date(checkoutState.expiresAt || "").getTime()) && (
            <p className="text-xs text-white/55">Expires {expiresAtLabel}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3">
          {qrImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImage}
                alt="Hosted checkout QR"
                className="h-52 w-52 rounded-[1.25rem] border border-white/12 bg-white object-contain p-3"
              />
              <a
                href={checkoutState.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-white underline underline-offset-4"
              >
                Open checkout link
              </a>
            </>
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded-[1.25rem] border border-dashed border-white/18 bg-white/5 px-6 text-center text-sm text-white/65">
              QR code will appear here once the session is ready.
            </div>
          )}
        </div>
      </div>

      {(checkoutState.phase === "expired" || checkoutState.phase === "error") && (
        <div className="mt-5 flex flex-wrap gap-3">
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
        <div className="mt-5 flex flex-wrap gap-3">
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
  )
}
