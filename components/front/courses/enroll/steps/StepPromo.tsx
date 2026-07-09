"use client"
import React from "react"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"

type StepPromoProps = {
  effectiveConsecutiveOffer: ConsecutiveOfferData | null | undefined
  effectiveIsPackageHolder: boolean
  consecutiveAccepted: boolean
  setConsecutiveAccepted: React.Dispatch<React.SetStateAction<boolean>>
  consecutiveChoiceMade: boolean
  setConsecutiveChoiceMade: React.Dispatch<React.SetStateAction<boolean>>
  setConsecutiveAddedCents: React.Dispatch<React.SetStateAction<number>>
  to12h: (value: string) => string
}

export default function StepPromo({
  effectiveConsecutiveOffer,
  effectiveIsPackageHolder,
  consecutiveAccepted,
  setConsecutiveAccepted,
  consecutiveChoiceMade,
  setConsecutiveChoiceMade,
  setConsecutiveAddedCents,
  to12h,
}: StepPromoProps) {
  return (
    <div className="space-y-4">
      {effectiveConsecutiveOffer && (() => {
        const consecutivePriceCents = effectiveIsPackageHolder
          ? (effectiveConsecutiveOffer.packageHolderConsecutiveCents ?? 0)
          : (effectiveConsecutiveOffer.dropInConsecutiveCents ?? 0)
        const regularPriceCents = effectiveConsecutiveOffer.regularDropInCents ?? 0
        return (
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-white/48">Add Second Class Promotion</p>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 mb-1">
                  Promo
                </span>
                <p className="text-sm font-semibold text-white leading-snug">{effectiveConsecutiveOffer.linkedCourseTitle}</p>
                {effectiveConsecutiveOffer.linkedCourseTime && (
                  <p className="mt-0.5 text-xs text-white/55">{to12h(effectiveConsecutiveOffer.linkedCourseTime)}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-emerald-300">${(consecutivePriceCents / 100).toFixed(2)}</p>
                {regularPriceCents > 0 && (
                  <p className="text-xs font-semibold text-red-300 line-through">${(regularPriceCents / 100).toFixed(2)}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setConsecutiveAccepted(true)
                  setConsecutiveChoiceMade(true)
                  setConsecutiveAddedCents(consecutivePriceCents)
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  consecutiveAccepted && consecutiveChoiceMade
                    ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-400/25"
                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:border-emerald-400/50"
                }`}
              >
                Add +${(consecutivePriceCents / 100).toFixed(2)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConsecutiveAccepted(false)
                  setConsecutiveChoiceMade(true)
                  setConsecutiveAddedCents(0)
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  consecutiveChoiceMade && !consecutiveAccepted
                    ? "border-red-500/60 bg-red-500/10 text-red-300 ring-2 ring-red-500/25"
                    : "border-red-500/25 bg-red-500/5 text-red-300/70 hover:border-red-500/40 hover:text-red-300"
                }`}
              >
                No thanks
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
