import React from "react"
import { CreditCard, Banknote, XCircle } from "lucide-react"

export type ConsecutiveOfferData = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  linkedCourseTime?: string
  dropInConsecutiveCents: number | null
  packageHolderConsecutiveCents: number | null
  regularDropInCents: number
  discountPercent: number
  hasAttendedFirstClass: boolean
}

type ConsecutiveClassOfferProps = {
  offer: ConsecutiveOfferData
  isPackageHolder: boolean
  onAccept: () => void
  onDecline: () => void
  onPayCash?: () => void
  onPayCard?: () => void
  isProcessing?: boolean
  processingAction?: "accept" | "decline" | "cash" | "card" | null
  showPaymentSelection?: boolean
}

const centsToUsd = (cents: number): string => {
  return (cents / 100).toFixed(2)
}

const resolveDiscountPercent = (input: {
  priceCents: number | null
  regularPriceCents: number
  fallbackPercent: number
}) => {
  if (input.priceCents == null || input.priceCents <= 0 || input.regularPriceCents <= 0) {
    return input.fallbackPercent
  }
  return Math.max(0, Math.round((1 - input.priceCents / input.regularPriceCents) * 100))
}

export function ConsecutiveClassOffer({
  offer,
  isPackageHolder,
  onAccept,
  onDecline,
  onPayCash,
  onPayCard,
  isProcessing = false,
  processingAction = null,
  showPaymentSelection = false,
}: ConsecutiveClassOfferProps) {
  const displayPriceCents = isPackageHolder
    ? offer.packageHolderConsecutiveCents
    : offer.dropInConsecutiveCents

  const displayPrice = displayPriceCents != null ? centsToUsd(displayPriceCents) : "—"
  const discountPercent = resolveDiscountPercent({
    priceCents: displayPriceCents,
    regularPriceCents: offer.regularDropInCents,
    fallbackPercent: offer.discountPercent,
  })
  const discountLabel = `${discountPercent}% off`

  const subtitle = isPackageHolder
    ? "Add your second class at a special price (separate from your package)"
    : "Add your second class at a special price"

  // Phase 2: Payment method selection
  if (showPaymentSelection) {
    return (
      <div
        aria-live="polite"
        aria-label="Payment method selection"
        className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
      >
        <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8 max-w-lg w-full">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            How would you like to pay?
          </h2>

          {/* Subtitle with class info and price */}
          <p className="mt-2 text-base text-white/70">
            {offer.linkedCourseTitle} — ${displayPrice}
          </p>

          {/* Payment buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onPayCash}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-[var(--brand,#b61616)] px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-[#a01212] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Banknote className="h-6 w-6" />
              {processingAction === "cash" ? "Processing..." : "Pay with Cash"}
            </button>
            <button
              type="button"
              onClick={onPayCard}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/10 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="h-6 w-6" />
              {processingAction === "card" ? "Processing..." : "Pay with Card"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Phase 1: Offer acceptance (original UI)
  return (
    <div
      aria-live="polite"
      aria-label="Consecutive class offer"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8 max-w-lg w-full">
        {/* Discount badge */}
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-400/20">
          <span className="text-lg">{discountLabel}</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">
          Add {offer.linkedCourseTitle}
        </h2>

        {/* Subtitle */}
        <p className="mt-2 text-base text-white/70">{subtitle}</p>

        {/* Price */}
        <div className="mt-6 rounded-xl bg-white/5 px-4 py-4 ring-1 ring-white/10">
          <p className="text-sm text-white/50">Your price</p>
          <p className="mt-1 text-4xl font-bold text-white">
            ${displayPrice}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAccept}
            disabled={isProcessing}
            className="w-full rounded-xl bg-[var(--brand,#b61616)] px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-[#a01212] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingAction === "accept" ? "Processing..." : "Add Class"}
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={isProcessing}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingAction === "decline" ? "Processing..." : "No Thanks"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConsecutiveOfferSuccess({
  courseTitle,
  onDone,
}: {
  courseTitle: string
  onDone: () => void
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Consecutive class added"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8 max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/20">
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-white">You&apos;re all set!</h2>
        <p className="mt-2 text-base text-white/70">
          Added <span className="font-medium text-white">{courseTitle}</span> to your schedule.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-6 w-full rounded-xl bg-white px-6 py-4 text-lg font-medium text-[#1a1d2e] transition-colors hover:bg-white/90"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function ConsecutiveOfferError({
  error,
  onRetry,
  onDismiss,
}: {
  error: string
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Error adding consecutive class"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 sm:p-8 max-w-md">
        <XCircle className="mx-auto h-14 w-14 text-red-400" />
        <h2 className="mt-4 text-2xl font-semibold text-white">Unable to add class</h2>
        <p className="mt-2 text-base text-white/70">{error}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-xl bg-[var(--brand,#b61616)] px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-[#a01212]"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-white/15"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
