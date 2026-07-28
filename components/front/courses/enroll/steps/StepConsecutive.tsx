"use client"
import React from "react"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"

type StepConsecutiveProps = {
  effectiveConsecutiveOffer: ConsecutiveOfferData
  effectiveIsPackageHolder: boolean
  consecutiveAccepted: boolean
  setConsecutiveAccepted: React.Dispatch<React.SetStateAction<boolean>>
  consecutiveChoiceMade: boolean
  setConsecutiveChoiceMade: React.Dispatch<React.SetStateAction<boolean>>
  setConsecutiveAddedCents: React.Dispatch<React.SetStateAction<number>>
  to12h: (value: string) => string
}

export default function StepConsecutive({
  effectiveConsecutiveOffer,
  effectiveIsPackageHolder,
  consecutiveAccepted,
  setConsecutiveAccepted,
  consecutiveChoiceMade,
  setConsecutiveChoiceMade,
  setConsecutiveAddedCents,
  to12h,
}: StepConsecutiveProps) {
  const consecutivePriceCents = effectiveIsPackageHolder
    ? (effectiveConsecutiveOffer.packageHolderConsecutiveCents ?? 0)
    : (effectiveConsecutiveOffer.dropInConsecutiveCents ?? 0)
  const regularPriceCents = effectiveConsecutiveOffer.regularDropInCents ?? 0

  const selectPromo = () => {
    setConsecutiveAccepted(true)
    setConsecutiveChoiceMade(true)
    setConsecutiveAddedCents(consecutivePriceCents)
  }

  const declinePromo = () => {
    setConsecutiveAccepted(false)
    setConsecutiveChoiceMade(true)
    setConsecutiveAddedCents(0)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={selectPromo}
        className={`relative w-full overflow-hidden rounded-[1.35rem] border px-5 py-5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(182,22,22,0.22),transparent_36%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))] ${
          consecutiveAccepted && consecutiveChoiceMade
            ? "border-emerald-400/70 ring-2 ring-emerald-400/25"
            : "border-white/14 hover:border-white/24 hover:brightness-110"
        }`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                Promo
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white">{effectiveConsecutiveOffer.linkedCourseTitle}</h3>
              {effectiveConsecutiveOffer.linkedCourseTime && (
                <p className="mt-1 text-sm text-white/55">{to12h(effectiveConsecutiveOffer.linkedCourseTime)}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-emerald-300">${(consecutivePriceCents / 100).toFixed(2)}</p>
              {regularPriceCents > 0 && (
                <p className="mt-1 text-sm font-semibold text-red-300 line-through">${(regularPriceCents / 100).toFixed(2)}</p>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-white/68">
            Add your second class at a special price. This will be added to your payment.
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={declinePromo}
        className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition ${
          consecutiveChoiceMade && !consecutiveAccepted
            ? "border-white/35 bg-white/[0.08] text-white ring-2 ring-white/10"
            : "border-white/12 bg-white/[0.03] text-white/72 hover:border-white/22 hover:text-white"
        }`}
      >
        Continue without promotion
      </button>
    </div>
  )
}
