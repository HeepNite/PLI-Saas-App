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
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-[10px] uppercase tracking-widest text-white/55">Add second class promotion</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                PROMO
              </span>
            </div>
            <p className="mt-1.5 font-semibold text-white leading-snug">{effectiveConsecutiveOffer.linkedCourseTitle}</p>
            {effectiveConsecutiveOffer.linkedCourseTime && (
              <p className="mt-0.5 text-xs text-white/55">{to12h(effectiveConsecutiveOffer.linkedCourseTime)}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            {regularPriceCents > consecutivePriceCents && (
              <p className="text-xs text-red-400 line-through leading-none">${(regularPriceCents / 100).toFixed(2)}</p>
            )}
            <p className="text-base font-bold text-white leading-snug">${(consecutivePriceCents / 100).toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={selectPromo}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              consecutiveAccepted && consecutiveChoiceMade
                ? "bg-emerald-600 text-white ring-2 ring-emerald-400/25"
                : "bg-emerald-500 text-white hover:bg-emerald-400"
            }`}
          >
            Add +${(consecutivePriceCents / 100).toFixed(2)}
          </button>
          <button
            type="button"
            onClick={declinePromo}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition ${
              consecutiveChoiceMade && !consecutiveAccepted
                ? "border-red-400/40 bg-red-500/10 text-red-400 ring-2 ring-red-400/25"
                : "border-red-400/30 bg-transparent text-red-400 hover:bg-red-500/10"
            }`}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  )
}
