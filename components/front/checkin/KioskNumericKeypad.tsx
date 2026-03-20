"use client"

import React from "react"
import { ArrowLeft } from "lucide-react"
import { KIOSK_NUMERIC_KEYPAD_DIGITS } from "@/lib/checkin/numeric-keypad"

export default function KioskNumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  disabled = false,
  className = "",
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 ${className}`.trim()}>
      <div className="grid grid-cols-3 gap-2">
        {KIOSK_NUMERIC_KEYPAD_DIGITS.slice(0, 9).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => onDigit(digit)}
            disabled={disabled}
            className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-lg font-semibold text-white transition hover:border-[var(--brand,#c71818)] hover:text-[var(--brand,#ff7a7a)] disabled:opacity-50"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-white transition hover:border-[var(--brand,#c71818)] hover:text-[var(--brand,#ff7a7a)] disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onDigit("0")}
          disabled={disabled}
          className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-lg font-semibold text-white transition hover:border-[var(--brand,#c71818)] hover:text-[var(--brand,#ff7a7a)] disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={onBackspace}
          disabled={disabled}
          aria-label="Delete last digit"
          className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-white transition hover:border-[var(--brand,#c71818)] hover:text-[var(--brand,#ff7a7a)] disabled:opacity-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
